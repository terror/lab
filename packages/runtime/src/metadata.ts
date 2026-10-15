import { defineDoc, defineDocFamily } from "@earendil-works/pi-durable";
import { type Static, Type } from "typebox";

export const ConfigurationSchema = Type.Object(
  {
    model: Type.Object(
      {
        provider: Type.String({ minLength: 1 }),
        modelId: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false },
    ),
    extensions: Type.Array(Type.String({ minLength: 1 }), {
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);

export type Configuration = Static<typeof ConfigurationSchema>;

export const ConfigurationDoc = defineDoc<{
  configuration: Configuration | null;
}>({
  kind: "lab.configuration",
  version: 1,
  scope: "session",
  initial: () => ({ configuration: null }),
});

export const ConversationDoc = defineDoc<{
  title: string;
  createdAt: number;
}>({
  kind: "lab.conversation",
  version: 1,
  scope: "conversation",
  history: "latest",
  fork: "initial",
  initial: () => ({ title: "", createdAt: Date.now() }),
});

export const CreationRequestDoc = defineDocFamily<
  { conversationId: number | null },
  null
>({
  kind: "lab.creation-request",
  version: 1,
  scope: "session",
  family: true,
  initial: () => ({ conversationId: null }),
});
