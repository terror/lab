import { fileURLToPath } from 'node:url';

import { config } from './config';
import { pool } from './db';
import initial from './migrations/001_initial.sql' with { type: 'text' };

const client = await pool.connect();

try {
  await client.query('SELECT pg_advisory_lock($1)', [1818321456]);

  await client.query('BEGIN');

  try {
    const { rows } = await client.query<{ name: string | null }>(
      "SELECT to_regclass('lab.migrations') AS name"
    );

    const applied = rows[0]?.name
      ? await client.query('SELECT name FROM lab.migrations WHERE name = $1', [
          '001_initial',
        ])
      : null;

    if (!applied?.rowCount) {
      await client.query(initial);

      await client.query(
        `CREATE TABLE lab.migrations (
          name text PRIMARY KEY,
          "appliedAt" timestamptz NOT NULL DEFAULT now()
        )`
      );

      await client.query('INSERT INTO lab.migrations (name) VALUES ($1)', [
        '001_initial',
      ]);
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
    await pool.end();
  }
}
