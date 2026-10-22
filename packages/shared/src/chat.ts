import type { JsonObject, JsonValue, SessionSnapshot } from './runtime';

export type ChatAccepted = {
  submissionId: string;
  snapshot: SessionSnapshot;
};

export type ChatResponseState =
  | { status: 'running' }
  | { status: 'retrying' }
  | { status: 'complete' }
  | { status: 'stopped' }
  | { status: 'error'; message: string };

export type ChatToolOutput = { text: string; details?: JsonValue };

export type ChatToolState =
  | { status: 'preparing' }
  | { status: 'running'; output?: ChatToolOutput }
  | { status: 'complete'; output: ChatToolOutput }
  | { status: 'error'; message: string };

export type ChatTextPart = { type: 'text'; id: string; text: string };

export type ChatToolPart = {
  type: 'tool';
  id: string;
  name: string;
  input: JsonObject;
} & ChatToolState;

export type ChatPart = ChatTextPart | ChatToolPart;

export type ChatUserMessage = { id: string; role: 'user'; text: string };

export type ChatAssistantMessage = {
  id: string;
  role: 'assistant';
  parts: ChatPart[];
  state: ChatResponseState;
};

export type ChatMessage = ChatUserMessage | ChatAssistantMessage;
