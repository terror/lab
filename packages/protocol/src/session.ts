import { type Static, Type } from 'typebox';

export const SessionId = Type.String({ minLength: 1 });

export type SessionId = Static<typeof SessionId>;

export const SubmissionKind = Type.Union([
  Type.Literal('prompt'),
  Type.Literal('steer'),
  Type.Literal('followUp'),
]);

export type SubmissionKind = Static<typeof SubmissionKind>;

export const Submission = Type.Object(
  {
    requestId: Type.String({ minLength: 1, maxLength: 128 }),
    text: Type.String({ minLength: 1 }),
    kind: Type.Optional(SubmissionKind),
  },
  { additionalProperties: false }
);

export type Submission = Static<typeof Submission>;
