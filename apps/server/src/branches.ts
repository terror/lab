import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Conversation, EntryId } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { and, eq, inArray, isNotNull, isNull, lte, or } from 'drizzle-orm';

import { db } from './db';
import { found } from './found';

const table = schema.conversation;

export type Parent = { conversationId: number; entryId: number | null };

type Fork = { after: number | null; chats: number[] };

type Segment = { cutoff: number | undefined; id: number; parent?: Parent };

type Group = { after: number | null; branches: number[]; original: number };

async function newestEntry(
  conversation: Conversation,
  { maxEntryId, minEntryId }: { maxEntryId: number; minEntryId?: number }
) {
  const { items } = await conversation.entries(
    {
      maxEntryId: maxEntryId as EntryId,
      minEntryId: minEntryId as EntryId | undefined,
    },
    1,
    undefined,
    BACKGROUND_CONTEXT
  );

  return items[0];
}

async function parentOf(id: number): Promise<Parent | undefined> {
  const [row] = await db
    .select({ entryId: table.parentEntryId, parentId: table.parentId })
    .from(table)
    .where(eq(table.id, id));

  if (!row || row.parentId === null) {
    return undefined;
  }

  return { conversationId: row.parentId, entryId: row.entryId };
}

export async function branchPoint(
  conversation: Conversation,
  entryId: number,
  role: 'assistant' | 'user'
) {
  const target = await newestEntry(conversation, {
    maxEntryId: entryId,
    minEntryId: entryId,
  });

  const entry = found(
    target?.model?.[0]?.role === role && target,
    'Message not found'
  );

  const previous = await newestEntry(conversation, {
    maxEntryId: entryId - 1,
  });

  if (previous) {
    return {
      entry,
      parent: { conversationId: previous.conversationId, entryId: previous.id },
    };
  }

  const parent = await parentOf(entry.conversationId);

  return {
    entry,
    parent: {
      conversationId:
        parent?.entryId === null ? parent.conversationId : entry.conversationId,
      entryId: null,
    },
  };
}

async function lineage(id: number, cutoff?: number): Promise<Segment[]> {
  const parent = await parentOf(id);

  const segment = { cutoff, id, parent };

  if (parent === undefined || parent.entryId === null) {
    return [segment];
  }

  return [segment, ...(await lineage(parent.conversationId, parent.entryId))];
}

function current(group: Group, segments: readonly Segment[]) {
  if (group.after === null) {
    return segments.at(-1)?.id;
  }

  const index = segments.findIndex(({ id }) => id === group.original);

  return segments[index]?.cutoff === group.after
    ? segments[index - 1]?.id
    : group.original;
}

async function liveChats(ownerId: string, ids: readonly number[]) {
  if (ids.length === 0) {
    return new Set<number>();
  }

  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(
      and(
        inArray(table.id, [...ids]),
        eq(table.ownerId, ownerId),
        isNull(table.deletedAt)
      )
    );

  return new Set(rows.map((row) => row.id));
}

export async function chatForks(ownerId: string, id: number): Promise<Fork[]> {
  const segments = await lineage(id);

  const root = segments.at(-1);

  const origin = root?.parent?.conversationId ?? root?.id ?? id;

  const children = await db
    .select({
      after: table.parentEntryId,
      id: table.id,
      original: table.parentId,
    })
    .from(table)
    .where(
      and(
        eq(table.ownerId, ownerId),
        isNull(table.deletedAt),
        or(
          and(eq(table.parentId, origin), isNull(table.parentEntryId)),
          ...segments.map((segment) =>
            and(
              eq(table.parentId, segment.id),
              segment.cutoff === undefined
                ? isNotNull(table.parentEntryId)
                : lte(table.parentEntryId, segment.cutoff)
            )
          )
        )
      )
    )
    .orderBy(table.id);

  const groups = new Map<string, Group>();

  for (const { after, id: chat, original } of children) {
    if (original === null) {
      continue;
    }

    const key = `${original}:${after}`;

    const group = groups.get(key) ?? { after, branches: [], original };

    groups.set(key, { ...group, branches: [...group.branches, chat] });
  }

  const live = await liveChats(
    ownerId,
    [...groups.values()].map(({ original }) => original)
  );

  return [...groups.values()]
    .map((group) => {
      const on = current(group, segments) ?? id;

      const chats = [...new Set([group.original, ...group.branches, on])]
        .toSorted((a, b) => a - b)
        .flatMap((chat) => {
          if (chat === on) {
            return [id];
          }

          return chat === group.original && !live.has(chat) ? [] : [chat];
        });

      return { after: group.after, chats };
    })
    .filter(({ chats }) => chats.length > 1)
    .toSorted((a, b) => (a.after ?? 0) - (b.after ?? 0));
}
