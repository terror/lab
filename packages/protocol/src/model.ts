import { type Static, Type } from 'typebox';

export const ModelRef = Type.Object(
  {
    provider: Type.String({ minLength: 1 }),
    modelId: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

export type ModelRef = Static<typeof ModelRef>;
