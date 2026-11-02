import { type Static, Type } from '@lab/protocol';

export const ErrorResponse = Type.Object(
  { error: Type.String() },
  { additionalProperties: false }
);

export type ErrorResponse = Static<typeof ErrorResponse>;
