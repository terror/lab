import { createDatabase } from '@lab/db';

import { env } from './env';

export const db = createDatabase(env.DATABASE_URL);
