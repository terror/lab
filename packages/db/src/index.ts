import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sql';

export function createDatabase(url: string) {
  return drizzle(url);
}

export async function ping(db: ReturnType<typeof createDatabase>) {
  await db.execute(sql`select 1`);
}
