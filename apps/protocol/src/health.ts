import { type Static, Type } from '@lab/protocol';

export const HealthResponse = Type.Object(
  { status: Type.Literal('ok') },
  { additionalProperties: false }
);

export type HealthResponse = Static<typeof HealthResponse>;
