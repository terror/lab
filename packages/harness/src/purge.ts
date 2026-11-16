import { DatabaseSync } from 'node:sqlite';

const PURGED = 'temp.lab_purge';

const scoped = `
  (scope_kind = 'conversation' and owner_id in (select id from ${PURGED}))
  or (scope_kind = 'task' and owner_id in (
    select id from tasks where conversation_id in (select id from ${PURGED})
  ))
`;

const statements = [
  `delete from ${PURGED} where id in (
    select json_extract(record, '$.parent.conversationId') from conversations
    where id not in (select id from ${PURGED})
  )`,
  `insert or ignore into ${PURGED} (id)
    with recursive owned(id) as (
      select id from ${PURGED}
      union
      select conversations.id from conversations
      join owned on conversations.owner_conversation_id = owned.id
    )
    select id from owned`,
  `delete from document_revisions where document_id in (
    select id from documents where ${scoped}
  )`,
  `delete from documents where ${scoped}`,
  `delete from entries where conversation_id in (select id from ${PURGED})`,
  `delete from submissions where conversation_id in (select id from ${PURGED})`,
  `delete from tasks where conversation_id in (select id from ${PURGED})`,
  `delete from conversations where id in (select id from ${PURGED})`,
];

export function purgeConversations(path: string, ids: readonly number[]) {
  if (ids.length === 0) {
    return [];
  }

  const database = new DatabaseSync(path);

  try {
    database.exec('pragma secure_delete = on');
    database.exec(`create temp table lab_purge (id integer primary key)`);

    const insert = database.prepare(
      `insert or ignore into ${PURGED} (id) values (?)`
    );

    database.exec('begin immediate');

    try {
      for (const id of ids) {
        insert.run(id);
      }

      for (const statement of statements) {
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
