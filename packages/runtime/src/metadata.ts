import {
  type ConversationId,
  defineDoc,
  defineDocFamily,
} from "@earendil-works/pi-durable";
import {
  ConversationIdSchema,
  ModelReferenceSchema,
  ToolNameSchema,
} from "@lab/wire";
import { type Static, Type } from "typebox";
import { validate } from "./validation";

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

const CreationRequestDocSchema = Type.Object(
  {
    conversationId: Type.Union([
      Type.Unsafe<ConversationId>(ConversationIdSchema),
      Type.Null(),
    ]),
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

export const CreationRequestDoc = defineDocFamily<
  Static<typeof CreationRequestDocSchema>,
  null
>({
  kind: "lab.creation-request",
  version: 1,
  scope: "session",
  family: true,
  initial: () => ({ conversationId: null }),
});

export function parseConfigurationDoc(value: unknown) {
  return validate(
    ConfigurationDocSchema,
    value,
    "Invalid stored runtime configuration",
  );
}

export function parseConversationDoc(value: unknown) {
  return validate(
    ConversationDocSchema,
    value,
    "Invalid stored conversation metadata",
  );
}

export function parseCreationRequestDoc(value: unknown) {
  return validate(
    CreationRequestDocSchema,
    value,
    "Invalid stored conversation creation request",
  );
}
