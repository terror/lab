import type {
  SessionMessage,
  SessionTool,
  SessionView,
} from '@lab/app-protocol';
import type { SessionSnapshot } from '@lab/harness-pi';
import { Type, Value } from '@lab/protocol';

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

      const content = text(message.content);

      const error =
        message.stopReason === 'error'
          ? message.errorMessage ||
            'The model could not complete this response.'
          : undefined;

      if (content || error || message.stopReason === 'aborted') {
        messages.push({
          id: `${entry.id}:${index}`,
          role: message.role,
          text: content,
          interrupted: message.stopReason === 'aborted',
          ...(error ? { error } : {}),
        });
      }
    }
  }

  const tools = snapshot.tasks
    .filter((task) => task.kind === 'pi.tool')
    .map((task): SessionTool => ({
      id: task.id,
      name: Value.Check(ToolInput, task.input)
        ? (names.get(task.input.callId) ?? 'Tool')
        : 'Tool',
      status:
        task.status === 'terminal'
          ? 'finished'
          : task.starts.length > 0
            ? 'running'
            : 'pending',
    }));

  return {
    sessionId: snapshot.sessionId,
    revision: snapshot.eventCount,
    running: snapshot.unfinished,
    messages,
    tools,
    partial: text(snapshot.live?.generation?.message?.content),
  };
}
