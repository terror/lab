import { hostNamed, method, remote } from "@earendil-works/chord";
import { Type } from "typebox";
import {
  ConversationIdSchema,
  ConversationListRevisionSchema,
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
  SetToolsInputSchema,
  StopInputSchema,
  StopReceiptSchema,
  SubmissionReceiptSchema,
  SubmitInputSchema,
  ToolCatalogSchema,
  ToolSelectionReceiptSchema,
} from "./schemas";

export { omitUndefined } from "./omit-undefined";
export * from "./schemas";

export const LabService = remote("lab.service", {
  version: 5,
  host: hostNamed("server"),
  input: Type.Object({}, { additionalProperties: false }),
  variants: {
    default: {
      state: { conversations: ConversationListRevisionSchema },
      methods: {
        listTools: method(
          Type.Object({}, { additionalProperties: false }),
          resultSchema(ToolCatalogSchema),
        ),
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
        deleteConversation: method(
          ConversationIdSchema,
          resultSchema(Type.Null()),
        ),
      },
    },
  },
});

const conversationMethods = {
  setTools: method(
    SetToolsInputSchema,
    resultSchema(ToolSelectionReceiptSchema),
  ),
  setModel: method(
    SetModelInputSchema,
    resultSchema(ModelSelectionReceiptSchema),
  ),
  submit: method(SubmitInputSchema, resultSchema(SubmissionReceiptSchema)),
  stop: method(StopInputSchema, resultSchema(StopReceiptSchema)),
};

export const LabConversation = remote("lab.conversation", {
  version: 5,
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
