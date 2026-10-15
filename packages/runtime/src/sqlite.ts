import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  SqliteDatabase,
  SqliteExecutor,
  SqliteValue,
} from "@earendil-works/pi-durable/storage/sqlite";

abstract class BunSqliteExecutor implements SqliteExecutor {
  constructor(protected readonly database: Database) {}

  exec(sql: string): Promise<void> {
    return this.runOperation(() => {
      this.database.run(sql);
    });
  }

  run(sql: string, ...params: SqliteValue[]): Promise<void> {
    return this.runOperation(() => {
      this.database.query<unknown, SqliteValue[]>(sql).run(...params);
    });
  }

  get<T extends object>(
    sql: string,
    ...params: SqliteValue[]
  ): Promise<T | undefined> {
    return this.runOperation(
      () =>
        this.database.query<T, SqliteValue[]>(sql).get(...params) ?? undefined,
    );
  }

  all<T extends object>(sql: string, ...params: SqliteValue[]): Promise<T[]> {
    return this.runOperation(() =>
      this.database.query<T, SqliteValue[]>(sql).all(...params),
    );
  }

  protected abstract runOperation<T>(
    operation: () => T | Promise<T>,
  ): Promise<T>;
}

class BunSqliteTransaction extends BunSqliteExecutor {
  active = true;

  protected async runOperation<T>(operation: () => T | Promise<T>): Promise<T> {
    if (!this.active) {
      throw new Error("SQLite transaction handle is no longer active");
    }

    return operation();
  }
}

export class BunSqliteDatabase
  extends BunSqliteExecutor
  implements SqliteDatabase
{
  private pending = Promise.resolve();
  private closing: Promise<void> | undefined;
  private failure: AggregateError | undefined;

  private constructor(database: Database) {
    super(database);
  }

  static async open(path: string): Promise<BunSqliteDatabase> {
    if (path.length === 0) {
      throw new Error("SQLite database path must not be empty");
    }

    if (path !== ":memory:") {
      await mkdir(dirname(path), { recursive: true });
    }

    const database = new Database(path, { create: true, strict: true });

    try {
      database.run("PRAGMA busy_timeout = 5000");

      const mode = database
        .query<{ journal_mode: string }, []>("PRAGMA journal_mode = WAL")
        .get();

      if (path !== ":memory:" && mode?.journal_mode !== "wal") {
        throw new Error("SQLite WAL mode is unavailable");
      }

      database.run("PRAGMA synchronous = FULL");
      database.run("PRAGMA wal_autocheckpoint = 1000");
      database.run("PRAGMA foreign_keys = ON");

      return new BunSqliteDatabase(database);
    } catch (error) {
      try {
        database.close(true);
      } catch (closeError) {
        throw new AggregateError(
          [error, closeError],
          "SQLite initialization failed and close failed",
        );
      }

      throw error;
    }
  }

  transaction<T>(
    callback: (transaction: SqliteExecutor) => Promise<T>,
  ): Promise<T> {
    return this.runOperation(async () => {
      this.database.run("BEGIN IMMEDIATE");
      const transaction = new BunSqliteTransaction(this.database);

      try {
        const result = await callback(transaction);
        transaction.active = false;
        this.database.run("COMMIT");
        return result;
      } catch (error) {
        transaction.active = false;

        try {
          this.database.run("ROLLBACK");
        } catch (rollbackError) {
          const failure = new AggregateError(
            [error, rollbackError],
            "SQLite transaction failed and rollback failed",
          );
          this.failure = failure;
          throw failure;
        }

        throw error;
      }
    });
  }

  close(): Promise<void> {
    this.closing ??= this.pending.then(() => this.database.close(true));
    return this.closing;
  }

  protected runOperation<T>(operation: () => T | Promise<T>): Promise<T> {
    if (this.closing !== undefined) {
      return Promise.reject(new Error("SQLite database is closing or closed"));
    }

    const result = this.pending.then(() => {
      if (this.failure !== undefined) {
        throw this.failure;
      }

      return operation();
    });

    this.pending = result.then(
      () => {},
      () => {},
    );

    return result;
  }
}
