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
