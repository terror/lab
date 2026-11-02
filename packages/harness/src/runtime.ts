import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import {
  type AgentChange,
  type Extension,
  Harness,
  type HarnessOptions,
  type ToolRegistration,
} from '@earendil-works/pi-durable';
import { type LocalWorld, createWorld } from '@workflow/world-local';
import {
  type ChatRoute,
  recoverSessions,
  registerQueue,
} from 'durable-harness';
import {
  type Opener,
  type PiChatRouteOptions,
  type SessionSnapshot,
  type WorldStorageOptions,
  acquireHarness,
  chatRoute,
  openWorldReader,
  resumeWith,
} from 'durable-harness/pi-durable';

export type AgentConfig<E extends Extension = Extension> = Omit<
  AgentChange,
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

export type RuntimeOptions<T extends ToolRegistration = ToolRegistration> =
  HarnessOptions<T> & {
    readonly dataDir: string;
  };

export type ChatOptions<T extends ToolRegistration = ToolRegistration> = Pick<
  PiChatRouteOptions,
  'authorize' | 'keepaliveMs' | 'allowPublicSandbox'
> & {
  readonly agent?: AgentConfig<Extension<T>>;
};

export class Runtime<T extends ToolRegistration = ToolRegistration> {
  private readonly world: LocalWorld;

  private readonly open: Opener;

  private readonly storage: WorldStorageOptions;

  constructor({ dataDir, ...options }: RuntimeOptions<T>) {
    this.world = createWorld({ dataDir, recoverActiveRuns: false });

    this.open = resumeWith(
      (storage) => Harness.open(storage, options, BACKGROUND_CONTEXT),
      { world: this.world }
    );

    this.storage = { world: this.world, traceAudience: 'private' };
  }

  async start() {
    registerQueue(this.world);

    await this.world.start?.();

    await recoverSessions(this.world);
  }

  async createSession(agent: AgentConfig<Extension<T>>) {
    const lease = await acquireHarness(undefined, this.open, this.storage);

    try {
      await lease.harness.root(BACKGROUND_CONTEXT, { agent });

      return lease.storage.sessionId;
    } finally {
      await lease.release();
    }
  }

  async readSession(sessionId: string): Promise<SessionSnapshot> {
    const reader = openWorldReader(sessionId, { world: this.world });

    await reader.refresh();

    return reader.snapshot();
  }

  async cancelSession(sessionId: string) {
    for (let attempt = 0; ; attempt++) {
      const lease = await acquireHarness(sessionId, this.open, this.storage);

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

  chatRoute(options: ChatOptions<T>): ChatRoute {
    return chatRoute({ ...options, open: this.open, ...this.storage });
  }
}
