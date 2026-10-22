import type { JsonValue, Message } from '@earendil-works/pi-ai';
import type { ToolTaskInput } from '@earendil-works/pi-durable';
import type * as Durable from 'durable-harness/pi-durable';

import type { SessionMetadata } from './sessions';

export type {
  AssistantMessage,
  JsonObject,
  JsonValue,
  Message,
  ToolResultMessage,
  Usage,
} from '@earendil-works/pi-ai';

export type SessionEntry = Omit<Durable.SessionEntry, 'model' | 'data'> & {
  model?: readonly Message[];
  data?: JsonValue;
};

export type SessionTask = Omit<Durable.SessionTask, 'input'> & {
  input?: JsonValue;
};

export type SessionSnapshot = Omit<
  Durable.SessionSnapshot,
  'entries' | 'tasks' | 'log' | 'commits'
> & {
  entries: SessionEntry[];
  tasks: SessionTask[];
  metadata: SessionMetadata;
};

export function isToolTask(
  task: SessionTask
): task is SessionTask & { input: ToolTaskInput } {
  const input = task.input;

  return (
    task.kind === 'pi.tool' &&
    input !== null &&
    typeof input === 'object' &&
    !Array.isArray(input) &&
    'assistant' in input &&
    typeof input.assistant === 'number' &&
    Number.isSafeInteger(input.assistant) &&
    'callId' in input &&
    typeof input.callId === 'string'
  );
}
