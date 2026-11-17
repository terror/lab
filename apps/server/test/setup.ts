import { fauxProvider } from '@earendil-works/pi-ai';
import { SQL } from 'bun';
import { afterAll, afterEach, mock } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = new URL(
  process.env.DATABASE_URL ?? 'postgres://lab:lab@127.0.0.1:5432/lab'
);

const database = `lab_test_${process.pid}`;

const admin = new SQL(url.href);

function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const stale = await admin<{ datname: string }[]>`
  select datname from pg_database where datname like 'lab_test%'
`;

for (const { datname } of stale) {
  const pid = Number(/^lab_test_(\d+)$/.exec(datname)?.[1]);

  if (!pid || !alive(pid)) {
    await admin.unsafe(`drop database if exists "${datname}" with (force)`);
  }
}

await admin.unsafe(`create database "${database}"`);

afterAll(async () => {
  await admin.unsafe(`drop database if exists "${database}" with (force)`);
  await admin.close();
});

afterEach(() => {
  mock.restore();
});

url.pathname = `/${database}`;

const models = [
  { id: 'anthropic/claude-sonnet-5.5' },
  {
    id: 'anthropic/claude-haiku-5.5',
    input: ['text' as const, 'image' as const],
  },
  { id: 'alibaba/qwen3-coder', input: ['text' as const] },
];

Object.assign(process.env, {
  AI_GATEWAY_API_KEY: 'foo',
  BETTER_AUTH_SECRET: 'foo'.repeat(11),
  DATABASE_URL: url.href,
  GOOGLE_CLIENT_ID: 'foo',
  GOOGLE_CLIENT_SECRET: 'foo',
  LAB_ADMIN_EMAIL: 'foo@example.com',
  LAB_ALLOWED_EMAILS: '*',
  LAB_ORIGIN: 'http://localhost:3000',
  LAB_STORAGE_PATH: join(await mkdtemp(join(tmpdir(), 'lab-')), 'lab.sqlite'),
});

const { applyMigrations, createDatabase } = await import('@lab/db');

const db = createDatabase(url.href);

await applyMigrations(db);
await db.$client.close();

const faux = fauxProvider({
  models,
  provider: 'vercel-ai-gateway',
});

const { respond } = await import('./models');

faux.setResponses(Array.from({ length: 10_000 }, () => respond));

const server = await import('../src/models');

server.models.setProvider(faux.provider);
