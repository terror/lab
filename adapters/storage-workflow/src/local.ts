import type { Storage } from '@lab/harness';
import { type LocalWorld, createWorld } from '@workflow/world-local';

export type LocalStorageOptions = NonNullable<
  Parameters<typeof createWorld>[0]
>;

export class LocalStorage implements Storage<LocalWorld> {
  readonly connection: LocalWorld;

  constructor(options: LocalStorageOptions = {}) {
    this.connection = createWorld(options);
  }

  async start() {
    await this.connection.start?.();
  }
}
