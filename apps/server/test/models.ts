import {
  type AssistantMessage,
  type FauxResponseStep,
  fauxAssistantMessage,
  fauxToolCall,
} from '@earendil-works/pi-ai';

const scripted: AssistantMessage[] = [];

export const prompts: Record<string, string>[] = [];

function sections(context: { messages: { role: string }[] }) {
  const [system] = context.messages.filter(
    (message) => message.role === 'system'
  );

  return system && 'sections' in system
    ? (system.sections as Record<string, string>)
    : {};
}

export function script(...messages: AssistantMessage[]) {
  scripted.push(...messages);
}

export const respond: FauxResponseStep = (context, options) => {
  if (options?.sessionId === undefined) {
    return fauxAssistantMessage('foo');
  }

  prompts.push(sections(context));

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
