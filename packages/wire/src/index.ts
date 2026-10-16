import { hostNamed, method, remote } from "@earendil-works/chord";
import { type Static, type TSchema, Type } from "typebox";

export { omitUndefined } from "./omit-undefined";

export const ConversationIdSchema = Type.Integer({
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
});

export const SubmissionIdSchema = Type.Integer({
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
});

export const EntryIdSchema = Type.Integer({
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
});

export const RequestIdSchema = Type.String({
  minLength: 1,
  maxLength: 128,
  pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
});

export const LabErrorSchema = Type.Object(
  {
    code: Type.Union([
      Type.Literal("invalid_input"),
      Type.Literal("not_found"),
      Type.Literal("busy"),
      Type.Literal("unavailable"),
      Type.Literal("provider_unavailable"),
      Type.Literal("model_unavailable"),
      Type.Literal("tool_unavailable"),
      Type.Literal("internal"),
    ]),
    message: Type.String(),
  },
  { additionalProperties: false },
);

export function resultSchema<T extends TSchema>(value: T) {
  return Type.Union([
    Type.Object(
      { ok: Type.Literal(true), value },
      { additionalProperties: false },
    ),
    Type.Object(
      { ok: Type.Literal(false), error: LabErrorSchema },
      { additionalProperties: false },
    ),
  ]);
}

export const ModelReferenceSchema = Type.Object(
  {
    provider: Type.String({ minLength: 1, maxLength: 200 }),
    modelId: Type.String({ minLength: 1, maxLength: 500 }),
  },
  { additionalProperties: false },
);

export const ModelInfoSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    name: Type.String(),
    contextWindow: Type.Number({ minimum: 0 }),
    maxTokens: Type.Number({ minimum: 0 }),
    reasoning: Type.Boolean(),
    input: Type.Array(
      Type.Union([Type.Literal("text"), Type.Literal("image")]),
    ),
    available: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const ProviderInfoSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    name: Type.String(),
    available: Type.Boolean(),
    models: Type.Array(ModelInfoSchema),
    error: Type.Optional(LabErrorSchema),
  },
  { additionalProperties: false },
);

export const ListModelsInputSchema = Type.Object(
  { refresh: Type.Boolean({ default: false }) },
  { additionalProperties: false },
);

export const ModelCatalogSchema = Type.Object(
  {
    defaultModel: Type.Optional(ModelReferenceSchema),
    providers: Type.Array(ProviderInfoSchema),
  },
  { additionalProperties: false },
);

export const SetModelInputSchema = Type.Object(
  { model: ModelReferenceSchema },
  { additionalProperties: false },
);

export const ModelSelectionReceiptSchema = Type.Object(
  {
    conversationId: ConversationIdSchema,
    model: ModelReferenceSchema,
    appliesAt: Type.Literal("next_request_preparation"),
  },
  { additionalProperties: false },
);

export const ToolNameSchema = Type.String({
  minLength: 1,
  maxLength: 64,
  pattern: "^[A-Za-z_][A-Za-z0-9_-]*$",
});

export const ToolSelectionSchema = Type.Array(ToolNameSchema, {
  uniqueItems: true,
});

export const ToolCatalogSchema = Type.Object(
  {
    defaultTools: ToolSelectionSchema,
    tools: Type.Array(
      Type.Object(
        {
          name: ToolNameSchema,
          description: Type.String(),
          extension: Type.String({ minLength: 1 }),
          replay: Type.Union([Type.Literal("safe"), Type.Literal("unsafe")]),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export const SetToolsInputSchema = Type.Object(
  { tools: ToolSelectionSchema },
  { additionalProperties: false },
);

export const ToolSelectionReceiptSchema = Type.Object(
  {
    conversationId: ConversationIdSchema,
    tools: ToolSelectionSchema,
    appliesAt: Type.Literal("next_submission"),
  },
  { additionalProperties: false },
);

export const ConversationSummarySchema = Type.Object(
  {
    id: ConversationIdSchema,
    title: Type.String({ maxLength: 200 }),
    createdAt: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
  },
  { additionalProperties: false },
);

export const ConversationListRevisionSchema = Type.Integer({
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
});

export const ListConversationsInputSchema = Type.Object(
  {
    limit: Type.Integer({ minimum: 1, maximum: 100, default: 50 }),
    cursor: Type.Optional(Type.String({ minLength: 1, maxLength: 2048 })),
  },
  { additionalProperties: false },
);

export const ConversationPageSchema = Type.Object(
  {
    items: Type.Array(ConversationSummarySchema, { maxItems: 100 }),
    next: Type.Optional(Type.String({ minLength: 1, maxLength: 2048 })),
  },
  { additionalProperties: false },
);

export const CreateConversationInputSchema = Type.Object(
  {
    requestId: RequestIdSchema,
    title: Type.String({ minLength: 1, maxLength: 200 }),
    model: Type.Optional(ModelReferenceSchema),
    tools: Type.Optional(ToolSelectionSchema),
  },
  { additionalProperties: false },
);

export const SubmitInputSchema = Type.Object(
  {
    requestId: RequestIdSchema,
    content: Type.String({ minLength: 1, maxLength: 100_000 }),
    whenBusy: Type.Union(
      [Type.Literal("reject"), Type.Literal("followUp"), Type.Literal("steer")],
      { default: "reject" },
    ),
  },
  { additionalProperties: false },
);

export const SubmissionReceiptSchema = Type.Object(
  {
    conversationId: ConversationIdSchema,
    submissionId: SubmissionIdSchema,
    requestId: RequestIdSchema,
    status: Type.Literal("admitted"),
  },
  { additionalProperties: false },
);

export const StopInputSchema = Type.Object(
  {
    scope: Type.Union([Type.Literal("foreground"), Type.Literal("all")]),
  },
  { additionalProperties: false },
);

export const StopReceiptSchema = Type.Object(
  {
    conversationId: ConversationIdSchema,
    scope: StopInputSchema.properties.scope,
    status: Type.Literal("stopped"),
  },
  { additionalProperties: false },
);

export const SubmissionStateSchema = Type.Union([
  Type.Object(
    { id: SubmissionIdSchema, status: Type.Literal("queued") },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      id: SubmissionIdSchema,
      status: Type.Literal("placed"),
      entryId: EntryIdSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      id: SubmissionIdSchema,
      status: Type.Literal("done"),
      entryId: EntryIdSchema,
      answerId: EntryIdSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      id: SubmissionIdSchema,
      status: Type.Literal("unanswered"),
      entryId: Type.Optional(EntryIdSchema),
      reason: Type.String(),
    },
    { additionalProperties: false },
  ),
]);

export const ToolCallSchema = Type.Object(
  {
    callId: Type.String({ minLength: 1 }),
    name: Type.String({ minLength: 1 }),
    arguments: Type.Record(Type.String(), Type.Unknown()),
  },
  { additionalProperties: false },
);

export const ToolResultSchema = Type.Object(
  {
    callId: ToolCallSchema.properties.callId,
    name: ToolCallSchema.properties.name,
    isError: Type.Boolean(),
    durationMs: Type.Optional(Type.Number({ minimum: 0 })),
    details: Type.Optional(Type.Unknown()),
  },
  { additionalProperties: false },
);

export const MessageSchema = Type.Union([
  Type.Object(
    {
      role: Type.Union([Type.Literal("user"), Type.Literal("system")]),
      text: Type.String(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      role: Type.Literal("assistant"),
      text: Type.String(),
      toolCalls: Type.Array(ToolCallSchema),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      role: Type.Literal("tool"),
      text: Type.String(),
      tool: ToolResultSchema,
    },
    { additionalProperties: false },
  ),
]);

export const TranscriptEntrySchema = Type.Object(
  {
    id: EntryIdSchema,
    kind: Type.String({ minLength: 1 }),
    messages: Type.Array(MessageSchema),
  },
  { additionalProperties: false },
);

const toolProgressProperties = {
  callId: ToolCallSchema.properties.callId,
  name: ToolCallSchema.properties.name,
  output: Type.String(),
  arguments: Type.Optional(ToolCallSchema.properties.arguments),
  details: Type.Optional(Type.Unknown()),
};

export const ToolProgressSchema = Type.Union([
  Type.Object(
    { ...toolProgressProperties, status: Type.Literal("pending") },
    { additionalProperties: false },
  ),
  Type.Object(
    { ...toolProgressProperties, status: Type.Literal("running") },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...toolProgressProperties,
      status: Type.Literal("succeeded"),
      durationMs: ToolResultSchema.properties.durationMs,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...toolProgressProperties,
      status: Type.Literal("failed"),
      durationMs: ToolResultSchema.properties.durationMs,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { ...toolProgressProperties, status: Type.Literal("interrupted") },
    { additionalProperties: false },
  ),
]);

export const QueuedInputSchema = Type.Object(
  {
    submissionId: SubmissionIdSchema,
    content: Type.String(),
    mode: Type.Union([Type.Literal("steer"), Type.Literal("followUp")]),
  },
  { additionalProperties: false },
);

export const ConversationStateSchema = Type.Object(
  {
    conversation: ConversationSummarySchema,
    model: Type.Optional(ModelReferenceSchema),
    selectedTools: ToolSelectionSchema,
    busy: Type.Boolean(),
    entries: Type.Array(TranscriptEntrySchema),
    partial: Type.Optional(Type.String()),
    tools: Type.Array(ToolProgressSchema),
    inbox: Type.Array(QueuedInputSchema),
    submissions: Type.Array(SubmissionStateSchema),
    error: Type.Optional(LabErrorSchema),
  },
  { additionalProperties: false },
);

export type ConversationId = Static<typeof ConversationIdSchema>;
export type ModelReference = Static<typeof ModelReferenceSchema>;
export type ModelInfo = Static<typeof ModelInfoSchema>;
export type ProviderInfo = Static<typeof ProviderInfoSchema>;
export type ListModelsInput = Static<typeof ListModelsInputSchema>;
export type ModelCatalog = Static<typeof ModelCatalogSchema>;
export type SetModelInput = Static<typeof SetModelInputSchema>;
export type ModelSelectionReceipt = Static<typeof ModelSelectionReceiptSchema>;
export type ToolCatalog = Static<typeof ToolCatalogSchema>;
export type SetToolsInput = Static<typeof SetToolsInputSchema>;
export type ToolSelectionReceipt = Static<typeof ToolSelectionReceiptSchema>;
export type SubmissionId = Static<typeof SubmissionIdSchema>;
export type RequestId = Static<typeof RequestIdSchema>;
export type LabError = Static<typeof LabErrorSchema>;
export type Result<T> = { ok: true; value: T } | { ok: false; error: LabError };
export type ConversationSummary = Static<typeof ConversationSummarySchema>;
export type ListConversationsInput = Static<
  typeof ListConversationsInputSchema
>;
export type ConversationPage = Static<typeof ConversationPageSchema>;
export type CreateConversationInput = Static<
  typeof CreateConversationInputSchema
>;
export type SubmitInput = Static<typeof SubmitInputSchema>;
export type SubmissionReceipt = Static<typeof SubmissionReceiptSchema>;
export type StopInput = Static<typeof StopInputSchema>;
export type StopReceipt = Static<typeof StopReceiptSchema>;
export type SubmissionState = Static<typeof SubmissionStateSchema>;
export type ToolCall = Static<typeof ToolCallSchema>;
export type ToolResult = Static<typeof ToolResultSchema>;
export type Message = Static<typeof MessageSchema>;
export type ToolProgress = Static<typeof ToolProgressSchema>;
export type ConversationState = Static<typeof ConversationStateSchema>;

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
