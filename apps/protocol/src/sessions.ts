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

export const SessionMessage = Type.Object({
  id: Type.String(),
  role: Type.Union([Type.Literal('user'), Type.Literal('assistant')]),
  text: Type.String(),
  interrupted: Type.Boolean(),
  error: Type.Optional(Type.String()),
});

export type SessionMessage = Static<typeof SessionMessage>;

export const SessionTool = Type.Object({
  id: Type.String(),
  name: Type.String(),
  status: Type.Union([
    Type.Literal('pending'),
    Type.Literal('running'),
    Type.Literal('finished'),
  ]),
});

export type SessionTool = Static<typeof SessionTool>;

export const SessionView = Type.Object({
  sessionId: SessionId,
  revision: Type.Integer({ minimum: 0 }),
  running: Type.Boolean(),
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
