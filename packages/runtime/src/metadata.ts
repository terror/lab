import { defineDoc, defineDocFamily } from "@earendil-works/pi-durable";
import {
  ModelReferenceSchema,
  SubmissionReceiptSchema,
  ToolNameSchema,
} from "@lab/wire";
import { type Static, Type } from "typebox";
import { Check } from "typebox/value";

export const ConfigurationSchema = Type.Object(
  {
    model: Type.Optional(ModelReferenceSchema),
    extensions: Type.Array(Type.String({ minLength: 1 }), {
      uniqueItems: true,
    }),
    extensionModules: Type.Optional(
      Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
    ),
    toolDefinitions: Type.Optional(
      Type.Array(
        Type.Object(
          {
            name: ToolNameSchema,
            extension: Type.String({ minLength: 1 }),
          },
          { additionalProperties: false },
        ),
      ),
    ),
    taskDefinitions: Type.Optional(
      Type.Array(
        Type.Object(
          {
            name: Type.String({ minLength: 1 }),
            extension: Type.String({ minLength: 1 }),
          },
          { additionalProperties: false },
        ),
      ),
    ),
  },
  { additionalProperties: false },
);

export type Configuration = Static<typeof ConfigurationSchema>;

const ConfigurationDocSchema = Type.Object(
  { configuration: Type.Union([ConfigurationSchema, Type.Null()]) },
  { additionalProperties: false },
);

const ConversationDocSchema = Type.Object(
  {
    title: Type.String(),
    createdAt: Type.Number(),
    deleted: Type.Boolean(),
  },
  { additionalProperties: false },
);

const StartRequestDocSchema = Type.Object(
  {
    receipt: Type.Union([SubmissionReceiptSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

export const ConfigurationDoc = defineDoc<
  Static<typeof ConfigurationDocSchema>
>({
  kind: "lab.configuration",
  version: 1,
  scope: "session",
  initial: () => ({ configuration: null }),
});

export const ConversationDoc = defineDoc<Static<typeof ConversationDocSchema>>({
  kind: "lab.conversation",
  version: 2,
  scope: "conversation",
  history: "latest",
  fork: "initial",
  initial: () => ({ title: "", createdAt: Date.now(), deleted: false }),
});

export const StartRequestDoc = defineDocFamily<
  Static<typeof StartRequestDocSchema>,
  null
>({
  kind: "lab.start-request",
  version: 1,
  scope: "session",
  family: true,
  initial: () => ({ receipt: null }),
});

export function parseConfigurationDoc(value: unknown) {
  if (!Check(ConfigurationDocSchema, value)) {
    throw new Error("Invalid stored runtime configuration");
  }

  return value;
}

export function parseConversationDoc(value: unknown) {
  if (!Check(ConversationDocSchema, value)) {
    throw new Error("Invalid stored conversation metadata");
  }

  return value;
}

export function parseStartRequestDoc(value: unknown) {
  if (!Check(StartRequestDocSchema, value)) {
    throw new Error("Invalid stored conversation start request");
  }

  return value;
}
