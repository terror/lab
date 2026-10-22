import { Pool } from 'pg';

import { config } from './config';

export const database = new Pool({ connectionString: config.databaseURL });

database.on('connect', (client) => {
  client.on('error', (error) =>
    console.error('Database connection failed', error)
  );
});

database.on('error', (error) => console.error('Database pool failed', error));
