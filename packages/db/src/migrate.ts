import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { fileURLToPath } from 'node:url';

import { createDatabase } from '.';

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('`DATABASE_URL` must be set');
}

const db = createDatabase(url);

await migrate(db, {
  migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)),
});

await db.$client.close();
