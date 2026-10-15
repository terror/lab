import { hostNamed, method, remote } from "@earendil-works/chord";
import { Type } from "typebox";
import {
  ConversationIdSchema,
  ConversationPageSchema,
  ConversationStateSchema,
  ConversationSummarySchema,
  CreateConversationInputSchema,
  ListConversationsInputSchema,
  ListModelsInputSchema,
  ModelCatalogSchema,
  ModelSelectionReceiptSchema,
  resultSchema,
  SetModelInputSchema,
  StopInputSchema,
  StopReceiptSchema,
  SubmissionReceiptSchema,
  SubmitInputSchema,
} from "./schemas";

export * from "./schemas";

export const LabService = remote("lab.service", {
  version: 2,
  host: hostNamed("server"),
  input: Type.Object({}, { additionalProperties: false }),
  variants: {
    default: {
      methods: {
        listModels: method(
          ListModelsInputSchema,
          resultSchema(ModelCatalogSchema),
        ),
        listConversations: method(
          ListConversationsInputSchema,
          resultSchema(ConversationPageSchema),
        ),
        createConversation: method(
          CreateConversationInputSchema,
          resultSchema(ConversationSummarySchema),
        ),
      },
    },
  },
});

const conversationMethods = {
  setModel: method(
    SetModelInputSchema,
    resultSchema(ModelSelectionReceiptSchema),
  ),
  submit: method(SubmitInputSchema, resultSchema(SubmissionReceiptSchema)),
  stop: method(StopInputSchema, resultSchema(StopReceiptSchema)),
};

export const LabConversation = remote("lab.conversation", {
  version: 2,
  host: hostNamed("server"),
  input: Type.Object(
    { id: ConversationIdSchema },
    { additionalProperties: false },
  ),
  variants: {
    commands: {
      methods: conversationMethods,
    },
    default: {
      state: { view: ConversationStateSchema },
      methods: conversationMethods,
    },
  },
});
