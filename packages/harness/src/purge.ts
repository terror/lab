import {
  applySqliteMigrations,
  CURRENT_SQLITE_SCHEMA_VERSION,
  SQLITE_MIGRATIONS,
} from '@earendil-works/pi-durable/storage/sqlite';
import { openNodeSqliteDatabase } from '@earendil-works/pi-durable/storage/sqlite/node';
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const PURGED = 'temp.lab_purge';

const storageSchema = `select type, name, sql from sqlite_schema
  where name not glob 'sqlite_*' and type <> 'index'
  order by type, name`;

const scoped = `
  (scope_kind = 'conversation' and owner_id in (select id from ${PURGED}))
  or (scope_kind = 'task' and owner_id in (
    select id from tasks where conversation_id in (select id from ${PURGED})
  ))
`;

const keepForkParents = `delete from ${PURGED} where id in (
  select json_extract(record, '$.parent.conversationId') from conversations
  where id not in (select id from ${PURGED})
)`;

const addOwned = `insert or ignore into ${PURGED} (id)
  with recursive owned(id) as (
    select id from ${PURGED}
    union
    select conversations.id from conversations
    join owned on conversations.owner_conversation_id = owned.id
      or conversations.owner_task_id in (
        select tasks.id from tasks where tasks.conversation_id = owned.id
      )
  )
  select id from owned`;

const deletions = [
  `delete from document_revisions where document_id in (
    select id from documents where ${scoped}
  )`,
  `delete from documents where ${scoped}`,
  `delete from entries where conversation_id in (select id from ${PURGED})`,
  `delete from submissions where conversation_id in (select id from ${PURGED})`,
  `delete from tasks where conversation_id in (select id from ${PURGED})`,
  `delete from conversations where id in (select id from ${PURGED})`,
];

async function supportedSchemas() {
  if (CURRENT_SQLITE_SCHEMA_VERSION !== 2) {
    throw new Error('Unsupported pi-durable SQLite storage version');
  }

  const database = await openNodeSqliteDatabase(':memory:');

  try {
    const schemas = new Map<string, number>();

    for (const migration of SQLITE_MIGRATIONS) {
      await applySqliteMigrations(
        database,
        SQLITE_MIGRATIONS.filter(({ version }) => version <= migration.version)
      );
      schemas.set(
        JSON.stringify(await database.all(storageSchema)),
        migration.version
      );
    }

    return schemas;
  } finally {
    await database.close();
  }
}

function prune(database: DatabaseSync): void {
  const { changes } = database.prepare(keepForkParents).run();

  if (Number(changes) > 0) {
    prune(database);
  }
}

export async function purgeConversations(path: string, ids: readonly number[]) {
  if (ids.length === 0) {
    return [];
  }

  if (!existsSync(path)) {
    return [...ids];
  }

  const schemas = await supportedSchemas();
  const database = new DatabaseSync(path);

  try {
    database.exec('pragma busy_timeout = 5000');
    database.exec('begin immediate');

    try {
      const schema = database.prepare(storageSchema).all();

      if (schema.length === 0) {
        database.exec('commit');
        return [...ids];
      }

      const version = schemas.get(JSON.stringify(schema));

      if (
        version === undefined ||
        database.prepare('select version from durable_schema').get()
          ?.version !== version
      ) {
        throw new Error('Unsupported pi-durable SQLite storage format');
      }

      database.exec('pragma secure_delete = on');
      database.exec(`create temp table lab_purge (id integer primary key)`);

      const insert = database.prepare(
        `insert or ignore into ${PURGED} (id) values (?)`
      );

      for (const id of ids) {
        insert.run(id);
      }

      prune(database);

      database.exec(addOwned);

      for (const statement of deletions) {
        database.exec(statement);
      }

      const purged = database
        .prepare(`select id from ${PURGED} order by id`)
        .all()
        .map(({ id }) => Number(id));

      database.exec('commit');

      return purged;
    } catch (error) {
      database.exec('rollback');
      throw error;
    }
  } finally {
    database.close();
  }
}
