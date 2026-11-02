import type {
  AssistantResult,
  SessionMessage,
  SessionStatus,
  SessionTool,
  SessionToolStatus,
  SessionView,
} from '@lab/app-protocol';
import type { SessionSnapshot } from '@lab/harness-pi';
import { type Static, Type, Value } from '@lab/protocol';

const TextPart = Type.Object({
  type: Type.Literal('text'),
  text: Type.String(),
});

const Message = Type.Object({
  role: Type.Union([Type.Literal('user'), Type.Literal('assistant')]),
  content: Type.Union([Type.String(), Type.Array(Type.Unknown())]),
  stopReason: Type.Optional(Type.String()),
  errorMessage: Type.Optional(Type.String()),
});

const ToolCall = Type.Object({
  type: Type.Literal('toolCall'),
  id: Type.String(),
  name: Type.String(),
});

const ToolInput = Type.Object({ callId: Type.String() });

function assistantResult(message: Static<typeof Message>): AssistantResult {
  switch (message.stopReason) {
    case 'aborted':
      return { status: 'interrupted' };

    case 'error':
      return {
        status: 'failed',
        error:
          message.errorMessage || 'The model could not complete this response.',
      };

    default:
      return { status: 'complete' };
  }
}

function messageView(
  id: string,
  message: Static<typeof Message>
): SessionMessage | undefined {
  const content = text(message.content);

  if (message.role === 'user') {
    return { id, role: 'user', text: content };
  }

  const result = assistantResult(message);

  if (!content && result.status === 'complete') {
    return undefined;
  }

  return { id, role: 'assistant', text: content, result };
}

function sessionStatus(
  snapshot: SessionSnapshot,
  messages: SessionMessage[]
): SessionStatus {
  if (snapshot.unfinished) {
    return 'running';
  }

  if (messages.at(-1)?.role === 'user') {
    return 'unanswered';
  }

  return 'idle';
}

function text(content: unknown) {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .filter((part) => Value.Check(TextPart, part))
    .map((part) => part.text)
    .join('');
}

function toolName(input: unknown, names: Map<string, string>) {
  if (!Value.Check(ToolInput, input)) {
    return 'Tool';
  }

  return names.get(input.callId) ?? 'Tool';
}

function toolStatus(status: string): SessionToolStatus {
  switch (status) {
    case 'pending':

    case 'running':

    case 'waiting':

    case 'completing':
      return status;

    case 'terminal':
      return 'finished';

    default:
      return 'unknown';
  }
}

export function sessionView(snapshot: SessionSnapshot): SessionView {
  const messages: SessionMessage[] = [];

  const names = new Map<string, string>();

  for (const entry of snapshot.entries) {
    if (entry.kind !== 'pi.user' && entry.kind !== 'pi.assistant') {
      continue;
    }

    for (const [index, message] of (entry.model ?? []).entries()) {
      if (!Value.Check(Message, message)) {
        continue;
      }

      if (Array.isArray(message.content)) {
        for (const part of message.content) {
          if (Value.Check(ToolCall, part)) {
            names.set(part.id, part.name);
          }
        }
      }

      const view = messageView(`${entry.id}:${index}`, message);

      if (view) {
        messages.push(view);
      }
    }
  }

  const tools = snapshot.tasks
    .filter((task) => task.kind === 'pi.tool')
    .map((task): SessionTool => ({
      id: task.id,
      name: toolName(task.input, names),
      status: toolStatus(task.status),
    }));

  return {
    sessionId: snapshot.sessionId,
    revision: snapshot.eventCount,
    status: sessionStatus(snapshot, messages),
    messages,
    tools,
    partial: text(snapshot.live?.generation?.message?.content),
  };
}
