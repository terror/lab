import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { config } from '../config';
import * as schema from './schema';

export const pool = new Pool({ connectionString: config.databaseURL });

pool.on('connect', (client) => {
  client.on('error', (error) =>
    console.error('Database connection failed', error)
  );
});

pool.on('error', (error) => console.error('Database pool failed', error));

export const database = drizzle({ client: pool, schema });

export type Database = Pick<
  typeof database,
  'select' | 'selectDistinct' | 'insert' | 'update' | 'delete'
>;
