import { getMigrations } from 'better-auth/db/migration';
import { fileURLToPath } from 'node:url';

import { authOptions } from './auth-options';
import { config } from './config';
import { database } from './database';
import initial from './migrations/001_initial.sql' with { type: 'text' };
import activity from './migrations/002_session_activity.sql' with { type: 'text' };

const client = await database.connect();

try {
  await client.query('SELECT pg_advisory_lock($1)', [1818321456]);

  const migrations = await getMigrations(authOptions);

  if (migrations.schemaProblems.length > 0) {
    throw new Error(migrations.schemaProblems.join('\n'));
  }

  await migrations.runMigrations();
  await client.query('BEGIN');

  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS lab');
    await client.query(
      `CREATE TABLE IF NOT EXISTS lab.migrations (
        name text PRIMARY KEY,
        "appliedAt" timestamptz NOT NULL DEFAULT now()
      )`
    );

    for (const [name, sql] of [
      ['001_initial', initial],
      ['002_session_activity', activity],
    ] as const) {
      const applied = await client.query(
        'SELECT name FROM lab.migrations WHERE name = $1',
        [name]
      );

      if (applied.rowCount === 0) {
        await client.query(sql);
        await client.query('INSERT INTO lab.migrations (name) VALUES ($1)', [
          name,
        ]);
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  const bootstrap = Bun.spawn(
    [
      process.execPath,
      fileURLToPath(import.meta.resolve('@workflow/world-postgres/cli')),
    ],
    {
      env: { ...process.env, WORKFLOW_POSTGRES_URL: config.workflowURL },
      stdout: 'inherit',
      stderr: 'inherit',
    }
  );

  if ((await bootstrap.exited) !== 0) {
    throw new Error('Harness database migration failed');
  }
} finally {
  try {
    await client.query('SELECT pg_advisory_unlock($1)', [1818321456]);
  } finally {
    client.release();
    await database.end();
  }
}
