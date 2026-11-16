import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sql';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { fileURLToPath } from 'node:url';

import * as schema from './schema';

export { schema };

export function createDatabase(url: string) {
  return drizzle(url, { schema });
}

export async function applyMigrations(db: ReturnType<typeof createDatabase>) {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)),
  });
}

export async function ping(db: ReturnType<typeof createDatabase>) {
  await db.execute(sql`select 1`);
}
