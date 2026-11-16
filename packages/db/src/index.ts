import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sql';

import * as schema from './schema';

export { schema };

export function createDatabase(url: string) {
  return drizzle(url, { schema });
}

export async function ping(db: ReturnType<typeof createDatabase>) {
  await db.execute(sql`select 1`);
}
