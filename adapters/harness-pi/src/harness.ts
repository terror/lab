import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import * as Pi from '@earendil-works/pi-durable';
import type { Gateway, Harness, Storage } from '@lab/harness';
import type { World } from '@workflow/world';
import { recoverSessions, registerQueue } from 'durable-harness';
import {
  type Opener,
  type SessionReader,
  type SessionSnapshot,
  type WorldStorageOptions,
  acquireHarness,
  openWorldReader,
  resumeWith,
} from 'durable-harness/pi-durable';

export type AgentConfig<E extends Pi.Extension = Pi.Extension> = Omit<
  Pi.AgentChange,
  'extensions' | 'tools'
> & {
  readonly extensions?:
    | readonly E[]
    | { readonly add?: readonly E[]; readonly remove?: readonly E[] }
    | null;
  readonly tools?:
    | readonly NonNullable<E['tools']>[number][]
    | { readonly remove: readonly NonNullable<E['tools']>[number][] }
    | null;
};

export type ExtensionTool<E extends readonly Pi.Extension[]> = NonNullable<
  E[number]['tools']
>[number];

export type PiHarnessOptions<
  E extends readonly Pi.Extension[] = readonly Pi.Extension[],
> = Omit<Pi.HarnessOptions<ExtensionTool<E>>, 'models' | 'registry'> & {
  readonly agent: AgentConfig<NoInfer<E[number]>>;
  readonly extensions?: E;
  readonly gateway: Gateway<Pi.HarnessOptions['models']>;
  readonly storage: Storage<World>;
  readonly name?: string;
};

export type PiContext = WorldStorageOptions & {
  readonly open: Opener;
  readonly agent: Pi.AgentChange;
};

export class PiHarness<
  const E extends readonly Pi.Extension[] = readonly [],
> implements Harness<SessionSnapshot> {
  readonly definition: AgentConfig<E[number]>;

  readonly extensions: readonly E[number][];

  readonly context: PiContext;

  private readonly storage: Storage<World>;

  private readonly readers = new Map<string, SessionReader>();

  private readonly reads = new Map<string, Promise<void>>();

  constructor({
    agent,
    extensions,
    gateway,
    storage,
    name,
    ...options
  }: PiHarnessOptions<E>) {
    const registry = Pi.createRegistry<ExtensionTool<E>>();

    this.definition = agent;

    this.extensions = extensions ?? [];

    for (const extension of this.extensions) {
      registry.install(extension);
    }

    this.storage = storage;

    const open = resumeWith(
      (journal) =>
        Pi.Harness.open(
          journal,
          { ...options, models: gateway.models, registry },
          BACKGROUND_CONTEXT
        ),
      { world: storage.connection, name }
    );

    this.context = {
      open,
      agent: this.definition,
      world: storage.connection,
      name,
      traceAudience: 'private',
    };
  }

  async start() {
    registerQueue(this.storage.connection);

    await this.storage.start();

    await recoverSessions(this.storage.connection);
  }

  async createSession() {
    const lease = await acquireHarness(
      undefined,
      this.context.open,
      this.context
    );

    try {
      await lease.harness.root(BACKGROUND_CONTEXT, { agent: this.definition });

      return lease.storage.sessionId;
    } finally {
      await lease.release();
    }
  }

  async readSession(sessionId: string): Promise<SessionSnapshot | undefined> {
    if (!/^wrun_[0-9A-HJKMNP-TV-Z]{26}$/.test(sessionId)) {
      return undefined;
    }

    const previous = this.reads.get(sessionId) ?? Promise.resolve();

    const result = previous.then(async () => {
      const reader = await this.sessionReader(sessionId);

      try {
        await reader.refresh();

        const snapshot = await reader.snapshot();

        return snapshot.eventCount === 0 ? undefined : snapshot;
      } catch (error) {
        if (this.readers.get(sessionId) === reader) {
          this.readers.delete(sessionId);
        }

        throw error;
      }
    });

    const settled = result.then(
      () => undefined,
      () => undefined
    );

    this.reads.set(sessionId, settled);

    void settled.then(() => {
      if (this.reads.get(sessionId) === settled) {
        this.reads.delete(sessionId);
      }
    });

    return result;
  }

  private async sessionReader(sessionId: string): Promise<SessionReader> {
    for (;;) {
      const cached = this.readers.get(sessionId);

      if (cached) {
        this.readers.delete(sessionId);

        this.readers.set(sessionId, cached);

        return cached;
      }

      if (this.readers.size < 64) {
        const reader = openWorldReader(sessionId, this.context);

        this.readers.set(sessionId, reader);

        return reader;
      }

      const idle = [...this.readers.keys()].find(
        (candidate) => !this.reads.has(candidate)
      );

      if (idle !== undefined) {
        this.readers.delete(idle);

        continue;
      }

      await Promise.race(this.reads.values());
    }
  }

  async cancelSession(sessionId: string) {
    for (let attempt = 0; ; attempt++) {
      const lease = await acquireHarness(
        sessionId,
        this.context.open,
        this.context
      );

      try {
        const root = await lease.harness.root(BACKGROUND_CONTEXT);

        await root.abort(BACKGROUND_CONTEXT, { background: true });

        return;
      } catch (error) {
        if (attempt === 0 && lease.storage.isFenced) {
          continue;
        }

        throw error;
      } finally {
        await lease.release();
      }
    }
  }
}
