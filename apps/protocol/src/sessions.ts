import { SessionId, type Static, Submission, Type } from '@lab/protocol';

export const SessionCreated = Type.Object(
  { sessionId: SessionId },
  { additionalProperties: false }
);

export type SessionCreated = Static<typeof SessionCreated>;

export const ChatSubmission = Type.Object(
  { sessionId: SessionId, ...Submission.properties },
  { additionalProperties: false }
);

export type ChatSubmission = Static<typeof ChatSubmission>;

export const AssistantResult = Type.Union([
  Type.Object(
    { status: Type.Literal('complete') },
    { additionalProperties: false }
  ),
  Type.Object(
    { status: Type.Literal('interrupted') },
    { additionalProperties: false }
  ),
  Type.Object(
    { status: Type.Literal('failed'), error: Type.String() },
    { additionalProperties: false }
  ),
]);

export type AssistantResult = Static<typeof AssistantResult>;

export const SessionMessage = Type.Union([
  Type.Object(
    {
      id: Type.String(),
      role: Type.Literal('user'),
      text: Type.String(),
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      id: Type.String(),
      role: Type.Literal('assistant'),
      text: Type.String(),
      result: AssistantResult,
    },
    { additionalProperties: false }
  ),
]);

export type SessionMessage = Static<typeof SessionMessage>;

export const SessionToolStatus = Type.Union([
  Type.Literal('pending'),
  Type.Literal('running'),
  Type.Literal('waiting'),
  Type.Literal('completing'),
  Type.Literal('finished'),
  Type.Literal('unknown'),
]);

export type SessionToolStatus = Static<typeof SessionToolStatus>;

export const SessionTool = Type.Object({
  id: Type.String(),
  name: Type.String(),
  status: SessionToolStatus,
});

export type SessionTool = Static<typeof SessionTool>;

export const SessionStatus = Type.Union([
  Type.Literal('idle'),
  Type.Literal('running'),
  Type.Literal('unanswered'),
]);

export type SessionStatus = Static<typeof SessionStatus>;

export const SessionView = Type.Object({
  sessionId: SessionId,
  revision: Type.Integer({ minimum: 0 }),
  status: SessionStatus,
  messages: Type.Array(SessionMessage),
  tools: Type.Array(SessionTool),
  partial: Type.String(),
});

export type SessionView = Static<typeof SessionView>;

export const ChatEvent = Type.Union([
  Type.Object({ type: Type.Literal('text'), delta: Type.String() }),
  Type.Object({
    type: Type.Union([Type.Literal('tool_start'), Type.Literal('tool_end')]),
    id: Type.String(),
    name: Type.Optional(Type.String()),
  }),
  Type.Object({ type: Type.Literal('rewind') }),
  Type.Object({ type: Type.Literal('idle') }),
]);

export type ChatEvent = Static<typeof ChatEvent>;
