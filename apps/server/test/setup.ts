import { fauxAssistantMessage, fauxProvider } from '@earendil-works/pi-ai';
import { SQL } from 'bun';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = new URL(
  process.env.DATABASE_URL ?? 'postgres://lab:lab@127.0.0.1:5432/lab'
);

const admin = new SQL(url.href);

await admin.unsafe('drop database if exists lab_test with (force)');
await admin.unsafe('create database lab_test');
await admin.close();

url.pathname = '/lab_test';

const models = [
  'anthropic/claude-sonnet-5.5',
  'anthropic/claude-haiku-5.5',
  'alibaba/qwen3-coder',
];

Object.assign(process.env, {
  AI_GATEWAY_API_KEY: 'foo',
  BETTER_AUTH_SECRET: 'foo'.repeat(11),
  DATABASE_URL: url.href,
  GOOGLE_CLIENT_ID: 'foo',
  GOOGLE_CLIENT_SECRET: 'foo',
  LAB_ADMIN_EMAIL: 'foo@example.com',
  LAB_ORIGIN: 'http://localhost:3000',
  LAB_STORAGE_PATH: join(await mkdtemp(join(tmpdir(), 'lab-')), 'lab.sqlite'),
});

const { applyMigrations, createDatabase } = await import('@lab/db');

const db = createDatabase(url.href);

await applyMigrations(db);
await db.$client.close();

const faux = fauxProvider({
  models: models.map((id) => ({ id })),
  provider: 'vercel-ai-gateway',
});

faux.setResponses(
  Array.from({ length: 1_000 }, () => fauxAssistantMessage('foo'))
);

const server = await import('../src/models');

server.models.setProvider(faux.provider);
