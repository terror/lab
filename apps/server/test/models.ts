import {
  type AssistantMessage,
  type FauxResponseStep,
  fauxAssistantMessage,
  fauxToolCall,
} from '@earendil-works/pi-ai';

const scripted: AssistantMessage[] = [];

export function script(...messages: AssistantMessage[]) {
  scripted.push(...messages);
}

export const respond: FauxResponseStep = (_context, options) => {
  if (options?.sessionId === undefined) {
    return fauxAssistantMessage('foo');
  }

  return scripted.shift() ?? fauxAssistantMessage('foo');
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
