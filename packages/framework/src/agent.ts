import { type Extension, createRegistry } from '@earendil-works/pi-durable';
import {
  type AgentConfig,
  type ChatOptions,
  type ChatRoute,
  Runtime,
  type RuntimeOptions,
  type SessionSnapshot,
  gatewayModels,
} from '@lab/harness';

export type AgentTool<E extends readonly Extension[]> = NonNullable<
  E[number]['tools']
>[number];

export type AgentOptions<
  E extends readonly Extension[] = readonly Extension[],
> = Omit<RuntimeOptions<AgentTool<E>>, 'models' | 'registry'> & {
  readonly agent: AgentConfig<NoInfer<E[number]>>;
  readonly extensions?: E;
  readonly models?: RuntimeOptions['models'];
};

export class Agent<const E extends readonly Extension[] = readonly []> {
  readonly definition: AgentConfig<E[number]>;

  readonly extensions: readonly E[number][];

  readonly runtime: Runtime<AgentTool<E>>;

  constructor({
    agent,
    extensions,
    models = gatewayModels(),
    ...options
  }: AgentOptions<E>) {
    const registry = createRegistry<AgentTool<E>>();

    this.definition = agent;

    this.extensions = extensions ?? [];

    for (const extension of this.extensions) {
      registry.install(extension);
    }

    this.runtime = new Runtime({ ...options, models, registry });
  }

  start() {
    return this.runtime.start();
  }

  createSession() {
    return this.runtime.createSession(this.definition);
  }

  readSession(sessionId: string): Promise<SessionSnapshot> {
    return this.runtime.readSession(sessionId);
  }

  cancelSession(sessionId: string) {
    return this.runtime.cancelSession(sessionId);
  }

  chatRoute(options: Omit<ChatOptions<AgentTool<E>>, 'agent'>): ChatRoute {
    return this.runtime.chatRoute({ ...options, agent: this.definition });
  }
}
