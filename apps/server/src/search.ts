import { schema } from '@lab/db';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { requireUser } from './auth';
import { db } from './db';
import { type Segment, searchMessages } from './message-search';
import { contains } from './records';
import { listTasks } from './schedule-access';
import { validator } from './validator';

const LIMIT = 8;

const conversation = schema.conversation;

type ChatResult = {
  id: number;
  projectId: number | null;
  snippet: Segment[] | null;
  title: string | null;
  updatedAt: string;
};

function words(query: string) {
  return query.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function includesAll(text: string, query: string) {
  const lower = text.toLowerCase();

  return words(query).every((word) => lower.includes(word.toLowerCase()));
}

async function chats(ownerId: string, query: string): Promise<ChatResult[]> {
  const titled = await db
    .select({
      id: conversation.id,
      lastMessageAt: conversation.lastMessageAt,
      projectId: conversation.projectId,
      title: conversation.title,
    })
    .from(conversation)
    .where(
      and(
        eq(conversation.ownerId, ownerId),
        isNull(conversation.deletedAt),
        ...words(query).map((word) => contains(conversation.title, word))
      )
    )
    .orderBy(desc(conversation.lastMessageAt))
    .limit(LIMIT);

  const messages = await searchMessages(ownerId, query, { limit: LIMIT });

  const seen = new Set(titled.map(({ id }) => id));

  return [
    ...titled.map(({ id, lastMessageAt, projectId, title }) => ({
      id,
      projectId,
      snippet: messages.find((match) => match.id === id)?.snippet ?? null,
      title,
      updatedAt: lastMessageAt.toISOString(),
    })),
    ...messages.filter(({ id }) => !seen.has(id)),
  ].slice(0, LIMIT);
}

async function projects(ownerId: string, query: string) {
  const rows = await db
    .select({
      chats: sql<number>`count(${conversation.id})::int`,
      id: schema.project.id,
      name: schema.project.name,
    })
    .from(schema.project)
    .leftJoin(
      conversation,
      and(
        eq(conversation.projectId, schema.project.id),
        isNull(conversation.deletedAt)
      )
    )
    .where(
      and(
        eq(schema.project.ownerId, ownerId),
        isNull(schema.project.deletedAt),
        ...words(query).map((word) => contains(schema.project.name, word))
      )
    )
    .groupBy(schema.project.id)
    .orderBy(schema.project.name)
    .limit(LIMIT);

  return rows;
}

async function schedules(ownerId: string, query: string) {
  return (await listTasks(ownerId))
    .filter(({ description, title }) =>
      includesAll(`${title} ${description}`, query)
    )
    .slice(0, LIMIT);
}

async function files(ownerId: string, query: string) {
  const item = schema.libraryItem;

  const rows = await db
    .select({
      createdAt: item.createdAt,
      id: item.id,
      kind: item.kind,
      name: item.name,
      size: item.size,
    })
    .from(item)
    .innerJoin(conversation, eq(conversation.id, item.conversationId))
    .where(
      and(
        eq(item.ownerId, ownerId),
        isNull(conversation.deletedAt),
        ...words(query).map((word) => contains(item.name, word))
      )
    )
    .orderBy(desc(item.createdAt), desc(item.id))
    .limit(LIMIT);

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

const query = validator(
  'query',
  z.object({ q: z.string().trim().min(1).max(200) })
);

const search = new Hono().use(requireUser).get('/', query, async (c) => {
  const ownerId = c.get('user').id;

  const { q } = c.req.valid('query');

  const [chatResults, projectResults, scheduleResults, fileResults] =
    await Promise.all([
      chats(ownerId, q),
      projects(ownerId, q),
      schedules(ownerId, q),
      files(ownerId, q),
    ]);

  return c.json({
    chats: chatResults,
    files: fileResults,
    projects: projectResults,
    schedules: scheduleResults,
  });
});

export default search;
