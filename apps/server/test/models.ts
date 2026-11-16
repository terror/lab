import {
  type AssistantMessage,
  type FauxResponseStep,
  fauxAssistantMessage,
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
