import {
  type AgentChange,
  type Extension,
  createRegistry,
} from '@earendil-works/pi-durable';
import {
  type ChatOptions,
  type RuntimeOptions,
  createRuntime,
  gatewayModels,
} from '@lab/harness';

export type AgentOptions = Omit<RuntimeOptions, 'models' | 'registry'> & {
  agent: AgentChange;
  extensions?: readonly Extension[];
  models?: RuntimeOptions['models'];
};

export function createAgent({
  agent,
  extensions = [],
  models = gatewayModels(),
  ...options
}: AgentOptions) {
  const registry = createRegistry();

  for (const extension of extensions) {
    registry.install(extension);
  }

  const runtime = createRuntime({ ...options, models, registry });

  return {
    ...runtime,
    createSession: () => runtime.createSession(agent),
    chatRoute: (options: Omit<ChatOptions, 'agent'>) =>
      runtime.chatRoute({ ...options, agent }),
  };
}
