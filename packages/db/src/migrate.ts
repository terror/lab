import { applyMigrations, createDatabase } from '.';

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('`DATABASE_URL` must be set');
}

const db = createDatabase(url);

await applyMigrations(db);

await db.$client.close();
