import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { applyImmutable } from '@earendil-works/chord/delta';
import {
  AgentDoc,
  type ConversationId,
  type EntryId,
  type SubmissionId,
} from '@earendil-works/pi-durable';
import { getBunServer } from '@hono/bun';
import { schema } from '@lab/db';
import {
  ANSWER_LENGTH,
  type Artifact,
  ArtifactsDoc,
  PlanDoc,
  QuestionsDoc,
  STORE_KEY_LENGTH,
  STORE_VALUE_LENGTH,
  TitleDoc,
  editPlan,
  titleChat,
} from '@lab/harness';
import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';

import { ASK_PROMPT_LENGTH, askModel } from './artifact-ask';
import { listPins, pinArtifact, unpinArtifact } from './artifact-pins';
import { deleteValue, readValue, saveValue } from './artifact-state';
import { type User, requireUser } from './auth';
import { branchChat, branchSchema, chatForks } from './branches';
import { createChat, pinChat, readChat, renameChat } from './chat-actions';
import { db } from './db';
import { fileHeaders } from './file-headers';
import { found } from './found';
import { harness } from './harness';
import { imageAt, stripImages, stripView } from './images';
import { rateLimit } from './limits';
import { listConversations, listSchema, listUnread, running } from './listing';
import {
  draftSchema,
  emptyMessage,
  nonEmpty,
  checkAttachments,
  submitMessage,
} from './messages';
import { defaultModel, findModel, modelChange, models } from './models';
import { moveChat } from './project-access';
import { registry } from './registry';
import { modelSchema, planStepsSchema, thinkingLevelSchema } from './schemas';
import { checkSpend } from './spend';
import { subscribeStatus } from './status';
import { moveToTrash } from './trash';
import { idParam, positiveId, validator } from './validator';

const imageParams = validator(
  'param',
  z.object({
    entryId: positiveId,
    id: positiveId,
    index: z.coerce.number().int().min(0),
  })
);

const submissionParams = validator(
  'param',
  z.object({
    id: positiveId,
    submissionId: positiveId,
  })
);

const message = validator(
  'json',
  draftSchema
    .extend({ steer: z.boolean().default(false) })
    .refine(nonEmpty, emptyMessage)
);

const creation = validator(
  'json',
  draftSchema
    .extend({
      model: z
        .object({ id: z.string().min(1), provider: z.string().min(1) })
        .optional(),
      projectId: z.number().int().positive().optional(),
      thinkingLevel: thinkingLevelSchema.optional(),
    })
    .refine(nonEmpty, emptyMessage)
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

const listQuery = validator('query', listSchema);

const artifactParams = validator(
  'param',
  z.object({
    artifactId: z.string().regex(/^[a-z0-9-]{1,40}$/),
    id: positiveId,
  })
);

const stateKey = validator(
  'query',
  z.object({ key: z.string().min(1).max(STORE_KEY_LENGTH) })
);

const stateValue = validator(
  'json',
  z.object({ value: z.string().max(STORE_VALUE_LENGTH) })
);

const asking = validator(
  'json',
  z.object({ prompt: z.string().trim().min(1).max(ASK_PROMPT_LENGTH) })
);

const pinning = validator(
  'json',
  z.object({ projectId: z.number().int().positive().nullable() })
);

const answering = validator(
  'json',
  z.object({
    answer: z.string().trim().min(1).max(ANSWER_LENGTH),
    callId: z.string().min(1).max(200),
  })
);

const planning = validator('json', z.object({ steps: planStepsSchema }));

const modelSelection = validator('json', modelSchema);

const branching = validator('json', branchSchema);

const update = validator(
  'json',
  z
    .object({
      pinned: z.boolean().optional(),
      projectId: z.number().int().positive().nullable().optional(),
      title: z.string().trim().min(1).max(200).optional(),
    })
    .refine(
      (value) => Object.values(value).some((field) => field !== undefined),
      {
        message: 'Nothing to update',
      }
    )
);

type Conversation = NonNullable<
  Awaited<ReturnType<typeof harness.conversation>>
>;

type BunServer = {
  timeout(request: Request, seconds: number): void;
};

async function watchPlan(conversation: Conversation) {
  await conversation.commit(async (tx) => {
    await tx.doc(PlanDoc, conversation.id);
  }, BACKGROUND_CONTEXT);

  return harness.watchDoc(PlanDoc, conversation.id, BACKGROUND_CONTEXT);
}

const owned = createMiddleware<{
  Variables: {
    conversation: Conversation;
    projectId: number | null;
    user: User;
  };
}>(async (c, next) => {
  const [record] = await db
    .select({
      id: schema.conversation.id,
      projectId: schema.conversation.projectId,
    })
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.id, Number(c.req.param('id'))),
        eq(schema.conversation.ownerId, c.get('user').id),
        isNull(schema.conversation.deletedAt)
      )
    );

  const conversation =
    record &&
    (await harness.conversation(
      record.id as ConversationId,
      BACKGROUND_CONTEXT
    ));

  if (!conversation) {
    throw new HTTPException(404, { message: 'Conversation not found' });
  }

  c.set('conversation', conversation);
  c.set('projectId', record.projectId);

  await next();
});

const artifact = createMiddleware<{
  Variables: { artifact: Artifact; conversation: Conversation };
}>(async (c, next) => {
  const doc = await harness.snapshot(
    ArtifactsDoc,
    c.var.conversation.id,
    BACKGROUND_CONTEXT
  );

  c.set(
    'artifact',
    found(doc?.artifacts[c.req.param('artifactId') ?? ''], 'Artifact not found')
  );

  await next();
});

const conversations = new Hono()
  .use(requireUser)
  .get('/', listQuery, async (c) =>
    c.json(await listConversations(c.get('user'), c.req.valid('query')))
  )
  .get('/unread', async (c) => c.json(await listUnread(c.get('user'))))
  .get('/pins', async (c) => c.json({ pins: await listPins(c.get('user').id) }))
  .post('/', rateLimit('messages'), creation, async (c) => {
    const user = c.get('user');
    const {
      attachments,
      content: text,
      model,
      projectId,
      thinkingLevel,
    } = c.req.valid('json');

    const chosen = model
      ? await findModel(model.provider, model.id)
      : await defaultModel();

    if (!chosen) {
      throw new HTTPException(400, {
        message: 'Add a provider in settings to start chatting',
      });
    }

    checkAttachments(chosen, attachments);

    const id = await createChat(user.id, {
      change: modelChange(chosen, thinkingLevel),
      draft: { attachments, content: text },
      projectId,
    });

    return c.json({ id }, 201);
  })
  .get('/:id', idParam, owned, async (c) => {
    const { conversation } = c.var;

    const doc = await harness.snapshot(
      TitleDoc,
      conversation.id,
      BACKGROUND_CONTEXT
    );

    const busy = await running();

    return c.json({
      forks: await chatForks(c.get('user').id, conversation.id),
      id: conversation.id,
      projectId: c.var.projectId,
      running: busy.has(conversation.id),
      title: doc?.title ?? null,
    });
  })
  .get('/:id/entries', idParam, owned, entriesQuery, async (c) => {
    const { conversation } = c.var;

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

    return c.json({ items: page.items.map(stripImages) });
  })
  .get('/:id/entries/:entryId/images/:index', imageParams, owned, async (c) => {
    const { entryId, index } = c.req.valid('param');

    const { conversation } = c.var;

    const { items } = await conversation.entries(
      {
        maxEntryId: entryId as EntryId,
        minEntryId: entryId as EntryId,
      },
      1,
      undefined,
      BACKGROUND_CONTEXT
    );

    const image = found(imageAt(items[0], index), 'Image not found');

    return c.body(
      Buffer.from(image.data, 'base64'),
      200,
      fileHeaders(image.mimeType)
    );
  })
  .get('/:id/events', idParam, owned, async (c) => {
    const { conversation } = c.var;

    getBunServer<BunServer>(c)?.timeout(c.req.raw, 0);

    return streamSSE(c, async (stream) => {
      const closed = new AbortController();

      stream.onAbort(() => closed.abort());

      const watch = await conversation.watch(BACKGROUND_CONTEXT);

      const plan = await watchPlan(conversation);

      const status = subscribeStatus(conversation.id, (value) =>
        stream.writeSSE({ event: 'status', data: value })
      );

      const stop = () => {
        status.unsubscribe();
        void watch.stop();
        void plan?.stop();
      };

      if (closed.signal.aborted) {
        stop();
        return;
      }

      closed.signal.addEventListener('abort', stop, { once: true });

      await stream.writeSSE({
        event: 'value',
        data: JSON.stringify(stripView(watch.value)),
      });

      let view = watch.value;

      watch.start(async (call) => {
        if (call.kind === 'value') {
          view = applyImmutable(view, call.ops);

          await stream.writeSSE({
            event: 'ops',
            data: JSON.stringify(call.ops),
          });

          void status.report(view);
        }
      });

      if (plan) {
        await stream.writeSSE({
          event: 'plan',
          data: JSON.stringify(plan.value),
        });

        plan.start(async (call) => {
          if (call.kind === 'value') {
            await stream.writeSSE({
              event: 'plan',
              data: JSON.stringify(call.value),
            });
          }
        });
      }

      const heartbeat = setInterval(() => {
        void stream.write(': ping\n\n');
      }, 25_000);

      await watch.closed;

      clearInterval(heartbeat);
      status.unsubscribe();
    });
  })
  .post(
    '/:id/messages',
    rateLimit('messages'),
    idParam,
    owned,
    message,
    async (c) => {
      const { conversation } = c.var;

      const { steer, ...draft } = c.req.valid('json');

      const agent = await harness.snapshot(
        AgentDoc,
        conversation.id,
        BACKGROUND_CONTEXT
      );

      checkAttachments(
        agent?.model &&
          models.getModel(agent.model.provider, agent.model.modelId),
        draft.attachments
      );

      const submission = await submitMessage(
        conversation,
        draft,
        steer ? 'steer' : 'followUp'
      );

      return c.json({ id: submission.id }, 202);
    }
  )
  .post(
    '/:id/branches',
    rateLimit('messages'),
    idParam,
    owned,
    branching,
    async (c) => {
      const id = await branchChat(
        c.get('user').id,
        c.var.conversation,
        c.var.projectId ?? undefined,
        c.req.valid('json')
      );

      return c.json({ id }, 201);
    }
  )
  .delete(
    '/:id/submissions/:submissionId',
    submissionParams,
    owned,
    async (c) => {
      const { submissionId } = c.req.valid('param');

      const { conversation } = c.var;

      const result = await harness.abortSubmission(
        submissionId as SubmissionId,
        BACKGROUND_CONTEXT,
        conversation.id
      );

      if (result === 'not_found') {
        throw new HTTPException(404, { message: 'Message not found' });
      }

      if (result !== 'aborted') {
        throw new HTTPException(409, { message: 'Message was already sent' });
      }

      return c.body(null, 204);
    }
  )
  .put('/:id/model', idParam, owned, modelSelection, async (c) => {
    const { conversation } = c.var;

    const { id, provider, thinkingLevel } = c.req.valid('json');

    await conversation.configure(
      modelChange(await findModel(provider, id), thinkingLevel),
      BACKGROUND_CONTEXT
    );

    return c.body(null, 204);
  })
  .post(
    '/:id/answers',
    rateLimit('messages'),
    idParam,
    owned,
    answering,
    async (c) => {
      await checkSpend(c.get('user').id);

      const { conversation } = c.var;

      const { answer, callId } = c.req.valid('json');

      await conversation.commit(async (tx) => {
        const doc = await tx.doc(QuestionsDoc, conversation.id);

        doc.answers[callId] ??= answer;
      }, BACKGROUND_CONTEXT);

      return c.body(null, 204);
    }
  )
  .put('/:id/plan', idParam, owned, planning, async (c) => {
    const { conversation } = c.var;

    const { steps } = c.req.valid('json');

    found(
      await conversation.commit(
        (tx) => editPlan(tx, conversation.id, steps),
        BACKGROUND_CONTEXT
      ),
      'Plan not found'
    );

    return c.body(null, 204);
  })
  .post('/:id/compact', rateLimit('messages'), idParam, owned, async (c) => {
    await checkSpend(c.get('user').id);

    const { conversation } = c.var;

    await conversation.compact(undefined, BACKGROUND_CONTEXT);

    return c.body(null, 202);
  })
  .post('/:id/read', idParam, owned, async (c) => {
    await readChat(c.get('user').id, c.var.conversation.id);

    return c.body(null, 204);
  })
  .post('/:id/abort', idParam, owned, async (c) => {
    const { conversation } = c.var;

    await conversation.abort(BACKGROUND_CONTEXT);

    await titleChat(conversation, registry, BACKGROUND_CONTEXT);

    return c.body(null, 204);
  })
  .get(
    '/:id/artifacts/:artifactId',
    artifactParams,
    owned,
    artifact,
    async (c) => {
      const { content, title, version } = c.var.artifact;

      return c.json({ content, title, version });
    }
  )
  .put(
    '/:id/artifacts/:artifactId/pin',
    artifactParams,
    owned,
    artifact,
    pinning,
    async (c) => {
      found(
        await pinArtifact(
          c.get('user').id,
          c.var.conversation.id,
          c.req.valid('param').artifactId,
          c.req.valid('json').projectId
        ),
        'Project not found'
      );

      return c.body(null, 204);
    }
  )
  .delete(
    '/:id/artifacts/:artifactId/pin',
    artifactParams,
    owned,
    async (c) => {
      await unpinArtifact(
        c.var.conversation.id,
        c.req.valid('param').artifactId
      );

      return c.body(null, 204);
    }
  )
  .get(
    '/:id/artifacts/:artifactId/state',
    artifactParams,
    owned,
    artifact,
    stateKey,
    async (c) => {
      const { artifactId } = c.req.valid('param');

      return c.json({
        value: await readValue(
          c.var.conversation.id,
          artifactId,
          c.req.valid('query').key
        ),
      });
    }
  )
  .put(
    '/:id/artifacts/:artifactId/state',
    artifactParams,
    owned,
    artifact,
    stateKey,
    stateValue,
    async (c) => {
      await saveValue(
        c.get('user').id,
        c.var.conversation.id,
        c.req.valid('param').artifactId,
        { key: c.req.valid('query').key, value: c.req.valid('json').value }
      );

      return c.body(null, 204);
    }
  )
  .delete(
    '/:id/artifacts/:artifactId/state',
    artifactParams,
    owned,
    artifact,
    stateKey,
    async (c) => {
      await deleteValue(
        c.var.conversation.id,
        c.req.valid('param').artifactId,
        c.req.valid('query').key
      );

      return c.body(null, 204);
    }
  )
  .post(
    '/:id/artifacts/:artifactId/ask',
    rateLimit('asks'),
    artifactParams,
    owned,
    artifact,
    asking,
    async (c) => {
      await checkSpend(c.get('user').id);

      return c.json({
        text: await askModel(
          c.var.conversation.id,
          c.req.valid('json').prompt,
          c.req.raw.signal
        ),
      });
    }
  )
  .patch('/:id', idParam, owned, update, async (c) => {
    const { conversation } = c.var;

    const { pinned, projectId, title } = c.req.valid('json');

    if (
      projectId !== undefined &&
      !(await moveChat(c.get('user').id, conversation.id, projectId))
    ) {
      throw new HTTPException(404, { message: 'Project not found' });
    }

    if (title !== undefined) {
      await renameChat(c.get('user').id, conversation.id, title);
    }

    if (pinned !== undefined) {
      await pinChat(c.get('user').id, conversation.id, pinned);
    }

    return c.body(null, 204);
  })
  .delete('/:id', idParam, owned, async (c) => {
    await moveToTrash('conversation', c.get('user').id, c.var.conversation.id);

    return c.body(null, 204);
  });

export default conversations;
