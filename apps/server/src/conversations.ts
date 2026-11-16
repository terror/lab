import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type {
  Conversation,
  ConversationId,
  EntryId,
} from '@earendil-works/pi-durable';
import { getBunServer } from '@hono/bun';
import { schema } from '@lab/db';
import { TitleDoc } from '@lab/harness';
import { and, desc, eq, exists, inArray, ne, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';

import { type User, requireUser } from './auth';
import { db } from './db';
import { harness } from './harness';
import { modelChange, thinkingLevelSchema } from './models';
import { validator } from './validator';

const params = validator(
  'param',
  z.object({ id: z.coerce.number().int().positive() })
);

const content = z.string().trim().min(1);

const message = validator('json', z.object({ content }));

const creation = validator(
  'json',
  z.object({
    content,
    model: z.string().min(1).optional(),
    thinkingLevel: thinkingLevelSchema.optional(),
  })
);

const entriesQuery = validator(
  'query',
  z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    maxEntryId: z.coerce.number().int().positive().optional(),
    minEntryId: z.coerce.number().int().positive().optional(),
    order: z.enum(['ascending', 'descending']).optional(),
  })
);

const modelSelection = validator(
  'json',
  z.object({
    id: z.string().min(1),
    thinkingLevel: thinkingLevelSchema.optional(),
  })
);

const rename = validator(
  'json',
  z.object({ title: z.string().trim().min(1).max(200) })
);

const sharing = validator(
  'json',
  z.object({
    members: z.array(z.string().min(1)).max(50),
    visibility: z.enum(['private', 'shared', 'family']),
  })
);

function submitMessage(
  conversation: Conversation,
  user: User,
  text: string,
  shared: boolean
) {
  return conversation.submit(
    {
      type: 'input',
      content: shared ? `${user.name}: ${text}` : text,
      entry: {
        kind: 'lab.message',
        data: { author: { id: user.id, name: user.name }, text },
      },
    },
    BACKGROUND_CONTEXT
  );
}

type BunServer = {
  timeout(request: Request, seconds: number): void;
};

function accessible(userId: string) {
  return or(
    eq(schema.conversation.ownerId, userId),
    eq(schema.conversation.visibility, 'family'),
    and(
      eq(schema.conversation.visibility, 'shared'),
      exists(
        db
          .select({ userId: schema.conversationMember.userId })
          .from(schema.conversationMember)
          .where(
            and(
              eq(
                schema.conversationMember.conversationId,
                schema.conversation.id
              ),
              eq(schema.conversationMember.userId, userId)
            )
          )
      )
    )
  );
}

async function load(id: number, user: User, { owner = false } = {}) {
  const [record] = await db
    .select({
      id: schema.conversation.id,
      ownerId: schema.conversation.ownerId,
      visibility: schema.conversation.visibility,
    })
    .from(schema.conversation)
    .where(and(eq(schema.conversation.id, id), accessible(user.id)));

  if (!record) {
    throw new HTTPException(404, { message: 'Conversation not found' });
  }

  if (owner && record.ownerId !== user.id) {
    throw new HTTPException(403, {
      message: 'Only the owner can change this conversation',
    });
  }

  const conversation = await harness.conversation(
    record.id as ConversationId,
    BACKGROUND_CONTEXT
  );

  if (!conversation) {
    throw new HTTPException(404, { message: 'Conversation not found' });
  }

  return { conversation, record };
}

const conversations = new Hono()
  .use(requireUser)
  .get('/', async (c) => {
    const user = c.get('user');

    const rows = await db
      .select({
        id: schema.conversation.id,
        ownerId: schema.conversation.ownerId,
        visibility: schema.conversation.visibility,
      })
      .from(schema.conversation)
      .where(accessible(user.id))
      .orderBy(desc(schema.conversation.createdAt))
      .limit(50);

    const items = await Promise.all(
      rows.map(async ({ id, ownerId, visibility }) => {
        const doc = await harness.snapshot(
          TitleDoc,
          id as ConversationId,
          BACKGROUND_CONTEXT
        );

        return {
          id,
          owned: ownerId === user.id,
          title: doc?.title ?? null,
          visibility,
        };
      })
    );

    return c.json({ conversations: items });
  })
  .post('/', creation, async (c) => {
    const user = c.get('user');
    const { content: text, model, thinkingLevel } = c.req.valid('json');

    const change =
      model === undefined ? undefined : modelChange(model, thinkingLevel);

    const conversation = await harness.createConversation(
      { ownership: { kind: 'ownerless' } },
      BACKGROUND_CONTEXT
    );

    await db
      .insert(schema.conversation)
      .values({ id: conversation.id, ownerId: user.id });

    if (change) {
      await conversation.configure(change, BACKGROUND_CONTEXT);
    }

    await submitMessage(conversation, user, text, false);

    return c.json({ id: conversation.id }, 201);
  })
  .get('/:id/entries', params, entriesQuery, async (c) => {
    const { conversation } = await load(c.req.valid('param').id, c.get('user'));

    const { limit, maxEntryId, minEntryId, order } = c.req.valid('query');

    const page = await conversation.entries(
      {
        maxEntryId: maxEntryId as EntryId | undefined,
        minEntryId: minEntryId as EntryId | undefined,
        order,
      },
      limit,
      undefined,
      BACKGROUND_CONTEXT
    );

    return c.json({ items: page.items });
  })
  .get('/:id/events', params, async (c) => {
    const { conversation } = await load(c.req.valid('param').id, c.get('user'));

    getBunServer<BunServer>(c)?.timeout(c.req.raw, 0);

    return streamSSE(c, async (stream) => {
      const watch = await conversation.watch(BACKGROUND_CONTEXT);

      stream.onAbort(() => void watch.stop());

      await stream.writeSSE({
        event: 'value',
        data: JSON.stringify(watch.value),
      });

      watch.start(async (call) => {
        if (call.kind === 'value') {
          await stream.writeSSE({
            event: 'ops',
            data: JSON.stringify(call.ops),
          });
        }
      });

      const heartbeat = setInterval(() => {
        void stream.write(': ping\n\n');
      }, 25_000);

      await watch.closed;

      clearInterval(heartbeat);
    });
  })
  .post('/:id/messages', params, message, async (c) => {
    const user = c.get('user');

    const { conversation, record } = await load(c.req.valid('param').id, user);

    const submission = await submitMessage(
      conversation,
      user,
      c.req.valid('json').content,
      record.visibility !== 'private'
    );

    return c.json({ id: submission.id }, 202);
  })
  .put('/:id/model', params, modelSelection, async (c) => {
    const { conversation } = await load(c.req.valid('param').id, c.get('user'));

    const { id, thinkingLevel } = c.req.valid('json');

    await conversation.configure(
      modelChange(id, thinkingLevel),
      BACKGROUND_CONTEXT
    );

    return c.body(null, 204);
  })
  .post('/:id/abort', params, async (c) => {
    const { conversation } = await load(c.req.valid('param').id, c.get('user'));

    await conversation.abort(BACKGROUND_CONTEXT);

    return c.body(null, 204);
  })
  .patch('/:id', params, rename, async (c) => {
    const { conversation } = await load(
      c.req.valid('param').id,
      c.get('user'),
      { owner: true }
    );

    const { title } = c.req.valid('json');

    await conversation.commit(async (tx) => {
      (await tx.doc(TitleDoc, conversation.id)).title = title;
    }, BACKGROUND_CONTEXT);

    return c.body(null, 204);
  })
  .delete('/:id', params, async (c) => {
    const { conversation } = await load(
      c.req.valid('param').id,
      c.get('user'),
      { owner: true }
    );

    await conversation.abort(BACKGROUND_CONTEXT);

    await db
      .delete(schema.conversation)
      .where(eq(schema.conversation.id, conversation.id));

    return c.body(null, 204);
  })
  .get('/:id/sharing', params, async (c) => {
    const { record } = await load(c.req.valid('param').id, c.get('user'));

    const members = await db
      .select({ userId: schema.conversationMember.userId })
      .from(schema.conversationMember)
      .where(eq(schema.conversationMember.conversationId, record.id));

    return c.json({
      members: members.map(({ userId }) => userId),
      visibility: record.visibility,
    });
  })
  .put('/:id/sharing', params, sharing, async (c) => {
    const user = c.get('user');

    const { record } = await load(c.req.valid('param').id, user, {
      owner: true,
    });

    const { members, visibility } = c.req.valid('json');

    const valid =
      members.length === 0
        ? []
        : await db
            .select({ id: schema.user.id })
            .from(schema.user)
            .where(
              and(inArray(schema.user.id, members), ne(schema.user.id, user.id))
            );

    await db.transaction(async (tx) => {
      await tx
        .update(schema.conversation)
        .set({ visibility })
        .where(eq(schema.conversation.id, record.id));

      await tx
        .delete(schema.conversationMember)
        .where(eq(schema.conversationMember.conversationId, record.id));

      if (valid.length > 0) {
        await tx
          .insert(schema.conversationMember)
          .values(
            valid.map(({ id }) => ({ conversationId: record.id, userId: id }))
          );
      }
    });

    return c.body(null, 204);
  });

export default conversations;
