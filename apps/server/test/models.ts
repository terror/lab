import {
  type FauxResponseFactory,
  type FauxResponseStep,
  fauxAssistantMessage,
  fauxToolCall,
} from '@earendil-works/pi-ai';
import { getCurrentSystemMessage } from '@earendil-works/pi-ai/utils/transcript';

const scripted: FauxResponseStep[] = [];

export const prompts: Record<string, string>[] = [];

function sections(context: Parameters<FauxResponseFactory>[0]) {
  return (getCurrentSystemMessage(context.messages)?.sections ?? {}) as Record<
    string,
    string
  >;
}

export function script(...steps: FauxResponseStep[]) {
  scripted.push(...steps);
}

export function clearScript() {
  scripted.length = 0;
}

export const respond: FauxResponseFactory = (
  context,
  options,
  state,
  model
) => {
  if (options?.sessionId === undefined) {
    return fauxAssistantMessage('foo');
  }

  prompts.push(sections(context));

  const next = scripted.shift() ?? fauxAssistantMessage('foo');

  return typeof next === 'function'
    ? next(context, options, state, model)
    : next;
};

export function toolCall(
  name: string,
  args: Parameters<typeof fauxToolCall>[1],
  id?: string
) {
  return fauxAssistantMessage(fauxToolCall(name, args, { id }), {
    stopReason: 'toolUse',
  });
}
