import { hostNamed, method, remote } from "@earendil-works/chord";
import { type Static, type TSchema, Type } from "typebox";

/**
 * Validates a persisted conversation identifier used to address a conversation.
 *
 * @remarks
 * Identifiers are positive integers within JavaScript's exact integer range.
 *
 * @see {@link ConversationId}
 */
export const ConversationIdSchema = Type.Integer({
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
});

/**
 * Validates the nonnegative safe integer published when list metadata changes.
 *
 * @remarks
 * The service starts at zero and publishes relevant storage commit sequence
 * numbers. Clients use changes to invalidate list pages; this is neither a
 * conversation count nor a promise of consecutive revision numbers.
 *
 * @see {@link LabService}
 */
export const ConversationListRevisionSchema = Type.Integer({
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
});

/**
 * Validates the persisted identifier of a transcript entry.
 *
 * @remarks
 * The positive safe integer identifies the whole entry, which may contain
 * multiple messages or no messages at all.
 *
 * @see {@link TranscriptEntrySchema}
 */
export const EntryIdSchema = Type.Integer({
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
});

/**
 * Validates an application error returned by an RPC or exposed in live state.
 *
 * @remarks
 * The code supports programmatic handling and the message explains the failure
 * to the user. The object accepts only these two fields.
 *
 * @see {@link LabError}
 */
export const LabErrorSchema = Type.Object(
  {
    /**
     * Classifies the failure:
     * - `invalid_input`: the runtime rejected the request or cursor.
     * - `not_found`: the conversation is missing or deleted.
     * - `busy`: current or queued work prevents the operation.
     * - `unavailable`: the runtime or current model request is unavailable.
     * - `provider_unavailable`: provider configuration, credentials, or
     *   discovery
     *   failed.
     * - `model_unavailable`: the selected model is missing or inaccessible.
     * - `tool_unavailable`: a selected tool or extension is unavailable.
     * - `internal`: an otherwise unclassified runtime operation failed.
     */
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
    /** Human-readable explanation suitable for displaying to the caller. */
    message: Type.String(),
  },
  { additionalProperties: false },
);

/**
 * Validates a request for a page of non-deleted conversations in descending ID
 * order.
 *
 * @remarks
 * Omit the cursor for the first page and pass a previous page's `next` value
 * unchanged to continue. The required limit has a schema default of 50.
 *
 * @see {@link ListConversationsInput}
 */
export const ListConversationsInputSchema = Type.Object(
  {
    /** Maximum number of conversations to return, from 1 to 100 inclusive. */
    limit: Type.Integer({ minimum: 1, maximum: 100, default: 50 }),
    /**
     * Opaque continuation token of 1 to 2,048 characters from an earlier page.
     */
    cursor: Type.Optional(Type.String({ minLength: 1, maxLength: 2048 })),
  },
  { additionalProperties: false },
);

/**
 * Validates options for retrieving the model catalog.
 *
 * @remarks
 * `refresh` is a required boolean with a schema default of `false`; requesting
 * a refresh allows the model registry to contact providers before listing
 * models.
 *
 * @see {@link ListModelsInput}
 */
export const ListModelsInputSchema = Type.Object(
  {
    /**
     * Whether to refresh model metadata with network access before listing it.
     */
    refresh: Type.Boolean({ default: false }),
  },
  { additionalProperties: false },
);

/**
 * Validates a model's catalog metadata and current availability.
 *
 * @remarks
 * Models remain in the catalog even when the configured credentials cannot use
 * them. Token limits describe model capabilities, not a request's token budget.
 *
 * @see {@link ModelInfo}
 */
export const ModelInfoSchema = Type.Object(
  {
    /** Non-empty model identifier, paired with its containing provider's ID. */
    id: Type.String({ minLength: 1 }),
    /** Display name presented in model selection interfaces. */
    name: Type.String(),
    /**
     * Advertised context window size in tokens, expressed as a nonnegative
     * number.
     */
    contextWindow: Type.Number({ minimum: 0 }),
    /**
     * Advertised maximum output token count, expressed as a nonnegative number.
     */
    maxTokens: Type.Number({ minimum: 0 }),
    /** Whether the model advertises support for reasoning. */
    reasoning: Type.Boolean(),
    /**
     * Input modalities advertised by the model, independently of the submit
     * API.
     */
    input: Type.Array(
      Type.Union([Type.Literal("text"), Type.Literal("image")]),
    ),
    /**
     * Whether this model is available with the server's configured credentials.
     */
    available: Type.Boolean(),
  },
  { additionalProperties: false },
);

/**
 * Validates the provider and model identifiers needed to select a model.
 *
 * @remarks
 * These are catalog identifiers rather than display names; the runtime checks
 * provider configuration and model availability separately.
 *
 * @see {@link ModelReference}
 */
export const ModelReferenceSchema = Type.Object(
  {
    /** Provider catalog identifier, containing 1 to 200 characters. */
    provider: Type.String({ minLength: 1, maxLength: 200 }),
    /**
     * Model identifier within that provider, containing 1 to 500 characters.
     */
    modelId: Type.String({ minLength: 1, maxLength: 500 }),
  },
  { additionalProperties: false },
);

/**
 * Validates a client-generated key used to deduplicate creation or submission.
 *
 * @remarks
 * Reuse the key when retrying the same operation. Creation keys are scoped to
 * the runtime session; submission keys are scoped to their conversation.
 *
 * Keys contain 1 to 128 ASCII characters, begin with a letter or digit, and
 * otherwise contain only letters, digits, periods, underscores, colons, or
 * hyphens.
 *
 * @see {@link RequestId}
 */
export const RequestIdSchema = Type.String({
  minLength: 1,
  maxLength: 128,
  pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
});

/**
 * Validates a request to stop work and withdraw queued inputs in a
 * conversation.
 *
 * @remarks
 * Foreground stopping leaves background work running; `all` also aborts work
 * across background ownership boundaries. The runtime waits for stopping to
 * complete before returning a receipt.
 *
 * @see {@link StopInput}
 */
export const StopInputSchema = Type.Object(
  {
    /** Whether to stop foreground work alone or include background work. */
    scope: Type.Union([Type.Literal("foreground"), Type.Literal("all")]),
  },
  { additionalProperties: false },
);

/**
 * Validates the identifier assigned to an admitted input submission.
 *
 * @remarks
 * Receipts and queued inputs use this positive safe integer to identify the
 * same submission independently of the client's request identifier.
 *
 * @see {@link SubmissionId}
 */
export const SubmissionIdSchema = Type.Integer({
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
});

/**
 * Validates the lifecycle state projected for the latest input submission.
 *
 * @remarks
 * `queued` input is waiting in the inbox, `placed` input is in the transcript
 * awaiting completion, and `done` input has completed. `unanswered` is a
 * terminal outcome with a reason, including cancellation or model failure.
 *
 * @see {@link SubmissionState}
 */
export const SubmissionStateSchema = Type.Union([
  Type.Object(
    {
      /** Queueing, transcript placement, or successful completion state. */
      status: Type.Union([
        Type.Literal("queued"),
        Type.Literal("placed"),
        Type.Literal("done"),
      ]),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      /** Terminal state for input that ended without an answer. */
      status: Type.Literal("unanswered"),
      /**
       * Runtime reason such as `aborted`, `reset`, `no_model`, or
       * `model_error`.
       */
      reason: Type.String(),
    },
    { additionalProperties: false },
  ),
]);

/**
 * Validates an assistant-requested tool invocation stored in the transcript.
 *
 * @remarks
 * Arguments are an arbitrary string-keyed object whose tool-specific validation
 * belongs to the runtime. The call ID correlates progress and the eventual
 * result.
 *
 * @see {@link ToolCall}
 */
export const ToolCallSchema = Type.Object(
  {
    /** Non-empty invocation identifier shared with its progress and result. */
    callId: Type.String({ minLength: 1 }),
    /**
     * Non-empty invoked name, preserved even when it is not in the current
     * catalog.
     */
    name: Type.String({ minLength: 1 }),
    /** Tool-defined argument object supplied by the assistant. */
    arguments: Type.Record(Type.String(), Type.Unknown()),
  },
  { additionalProperties: false },
);

/**
 * Validates a registered tool name used in conversation selections.
 *
 * @remarks
 * Names contain 1 to 64 ASCII characters, start with a letter or underscore,
 * and otherwise contain only letters, digits, underscores, or hyphens.
 *
 * @see {@link ToolSelectionSchema}
 */
export const ToolNameSchema = Type.String({
  minLength: 1,
  maxLength: 64,
  pattern: "^[A-Za-z_][A-Za-z0-9_-]*$",
});

/**
 * Validates the metadata used to identify a conversation in lists and views.
 *
 * @remarks
 * Summaries contain no transcript or activity state, and creation times use
 * Unix epoch milliseconds.
 *
 * @see {@link ConversationSummary}
 */
export const ConversationSummarySchema = Type.Object(
  {
    /**
     * Persisted identifier used to open, command, or delete the conversation.
     */
    id: ConversationIdSchema,
    /**
     * Display title of at most 200 characters; stored summaries may be empty.
     */
    title: Type.String({ maxLength: 200 }),
    /**
     * Creation time in Unix epoch milliseconds, stored as a nonnegative safe
     * integer.
     */
    createdAt: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
  },
  { additionalProperties: false },
);

/**
 * Validates confirmation that a conversation's model selection was saved.
 *
 * @remarks
 * The receipt specifies when the change takes effect; it does not describe the
 * model used by a request that was already prepared.
 *
 * @see {@link ModelSelectionReceipt}
 */
export const ModelSelectionReceiptSchema = Type.Object(
  {
    /** Conversation whose model selection changed. */
    conversationId: ConversationIdSchema,
    /** Validated provider and model selected by the runtime. */
    model: ModelReferenceSchema,
    /** The selection is read when preparing the next model request. */
    appliesAt: Type.Literal("next_request_preparation"),
  },
  { additionalProperties: false },
);

/**
 * Validates a provider's catalog entry, models, and optional discovery error.
 *
 * @remarks
 * Availability records whether authentication and model discovery succeeded. A
 * refresh error may coexist with an available provider and cached models.
 *
 * @see {@link ProviderInfo}
 */
export const ProviderInfoSchema = Type.Object(
  {
    /**
     * Non-empty identifier used by model references to select this provider.
     */
    id: Type.String({ minLength: 1 }),
    /** Human-readable provider name. */
    name: Type.String(),
    /** Whether the runtime could resolve credentials and available models. */
    available: Type.Boolean(),
    /** Known models, including models currently unavailable to the server. */
    models: Type.Array(ModelInfoSchema),
    /**
     * Authentication, discovery, or refresh failure, omitted when none
     * occurred.
     */
    error: Type.Optional(LabErrorSchema),
  },
  { additionalProperties: false },
);

/**
 * Validates an admitted user input that is still waiting in the inbox.
 *
 * @remarks
 * Only steer and follow-up inputs are exposed; queued runtime writes are
 * omitted from the wire view. Content is projected into plain text.
 *
 * @see {@link ConversationStateSchema}
 */
export const QueuedInputSchema = Type.Object(
  {
    /** Submission identifier also returned by the admission receipt. */
    submissionId: SubmissionIdSchema,
    /** Text waiting to be placed into the conversation. */
    content: Type.String(),
    /** Whether the input joins current work or starts a follow-up run. */
    mode: Type.Union([Type.Literal("steer"), Type.Literal("followUp")]),
  },
  { additionalProperties: false },
);

/**
 * Validates a request to replace a conversation's selected model.
 *
 * @remarks
 * The runtime validates availability before saving the selection, which takes
 * effect when the next model request is prepared, including during an active
 * run.
 *
 * @see {@link SetModelInput}
 */
export const SetModelInputSchema = Type.Object(
  {
    /** Provider and model to use for subsequent request preparation. */
    model: ModelReferenceSchema,
  },
  { additionalProperties: false },
);

/**
 * Validates confirmation that a stop operation completed for the chosen scope.
 *
 * @remarks
 * The echoed scope distinguishes foreground cancellation from cancellation that
 * also includes background work.
 *
 * @see {@link StopReceipt}
 */
export const StopReceiptSchema = Type.Object(
  {
    /** Conversation whose work was stopped. */
    conversationId: ConversationIdSchema,
    /** Scope requested by the caller and applied by the runtime. */
    scope: StopInputSchema.properties.scope,
    /** Confirmation that the runtime's abort operation has completed. */
    status: Type.Literal("stopped"),
  },
  { additionalProperties: false },
);

/**
 * Validates acknowledgment that input was admitted or previously admitted.
 *
 * @remarks
 * A receipt identifies the submission but does not imply it has been placed in
 * the transcript or answered. Progress is reported through conversation state.
 *
 * @see {@link SubmissionReceipt}
 */
export const SubmissionReceiptSchema = Type.Object(
  {
    /** Conversation that accepted the input. */
    conversationId: ConversationIdSchema,
    /** Persisted submission identifier assigned by the runtime. */
    submissionId: SubmissionIdSchema,
    /** Echo of the caller's deduplication key. */
    requestId: RequestIdSchema,
    /**
     * Admission acknowledgment, independent of the submission's current state.
     */
    status: Type.Literal("admitted"),
  },
  { additionalProperties: false },
);

/**
 * Validates a text input submitted to a conversation using a deduplication key.
 *
 * @remarks
 * Admission may start work immediately or queue it according to `whenBusy`.
 * Retrying the same request ID retrieves the existing submission rather than
 * placing the input a second time.
 *
 * @see {@link SubmitInput}
 */
export const SubmitInputSchema = Type.Object(
  {
    /**
     * Client-generated key scoped to this conversation and stable across
     * retries.
     */
    requestId: RequestIdSchema,
    /** User text containing 1 to 100,000 characters. */
    content: Type.String({ minLength: 1, maxLength: 100_000 }),
    /**
     * Busy policy, with a schema default of `reject`: reject admission while
     * busy, queue a `followUp` for the next run, or queue a `steer` to join the
     * current work at a turn boundary. The field is required in the wire type.
     */
    whenBusy: Type.Union(
      [Type.Literal("reject"), Type.Literal("followUp"), Type.Literal("steer")],
      { default: "reject" },
    ),
  },
  { additionalProperties: false },
);

/**
 * Common property schemas shared by every live tool-progress status.
 *
 * @remarks
 * Top-level and nested invocations use the same shape; arguments and details
 * remain optional because the runtime may not have them for every observation.
 *
 * @see {@link ToolProgressSchema}
 *
 * @internal
 */
const toolProgressProperties = {
  /** Invocation identifier used to correlate transcript calls and results. */
  callId: ToolCallSchema.properties.callId,
  /** Name of the tool being observed. */
  name: ToolCallSchema.properties.name,
  /** Current output snapshot, which may be empty before output is available. */
  output: Type.String(),
  /** Invocation arguments when exposed by the runtime's live tool slot. */
  arguments: Type.Optional(ToolCallSchema.properties.arguments),
  /** Optional tool-defined progress or result data. */
  details: Type.Optional(Type.Unknown()),
};

/**
 * Validates metadata attached to a tool-result message in the transcript.
 *
 * @remarks
 * The message's text is stored separately in `Message.text`; this object
 * records invocation identity, success or failure, and optional execution
 * metadata.
 *
 * @see {@link ToolResult}
 */
export const ToolResultSchema = Type.Object(
  {
    /** Identifier of the tool call that produced this result. */
    callId: ToolCallSchema.properties.callId,
    /** Tool name associated with the originating call. */
    name: ToolCallSchema.properties.name,
    /** Whether the invocation produced an error result. */
    isError: Type.Boolean(),
    /** Nonnegative execution duration in milliseconds, when available. */
    durationMs: Type.Optional(Type.Number({ minimum: 0 })),
    /** Optional tool-defined data without a common wire-level structure. */
    details: Type.Optional(Type.Unknown()),
  },
  { additionalProperties: false },
);

/**
 * Validates an explicit tool selection as an array of distinct tool names.
 *
 * @remarks
 * An empty array selects no tools. Name syntax and uniqueness are checked here;
 * the runtime separately verifies that every selected tool is registered.
 *
 * @see {@link SetToolsInputSchema}
 */
export const ToolSelectionSchema = Type.Array(ToolNameSchema, {
  uniqueItems: true,
});

/**
 * Validates one page of conversation summaries, containing at most 100 items.
 *
 * @remarks
 * An absent continuation token means the scan is exhausted. The token is opaque
 * to callers and is passed back through `ListConversationsInput.cursor`.
 *
 * @see {@link ConversationPage}
 */
export const ConversationPageSchema = Type.Object(
  {
    /** Non-deleted conversation summaries in descending identifier order. */
    items: Type.Array(ConversationSummarySchema, { maxItems: 100 }),
    /**
     * Continuation token for the next scan, omitted once there is no next page.
     */
    next: Type.Optional(Type.String({ minLength: 1, maxLength: 2048 })),
  },
  { additionalProperties: false },
);

/**
 * Validates an idempotent request to create a conversation with initial
 * settings.
 *
 * @remarks
 * Missing model and tool selections use the runtime defaults; an explicit empty
 * tool array selects no tools. Retrying a request ID returns the existing
 * conversation's current summary, unless that conversation is unavailable.
 *
 * @see {@link CreateConversationInput}
 */
export const CreateConversationInputSchema = Type.Object(
  {
    /** Client-generated creation key, reused when retrying this operation. */
    requestId: RequestIdSchema,
    /** Initial display title, containing 1 to 200 characters. */
    title: Type.String({ minLength: 1, maxLength: 200 }),
    /** Initial model selection; omission uses the configured default model. */
    model: Type.Optional(ModelReferenceSchema),
    /** Initial tool selection; omission uses the catalog's default tools. */
    tools: Type.Optional(ToolSelectionSchema),
  },
  { additionalProperties: false },
);

/**
 * Validates a display-oriented transcript message, discriminated by `role`.
 *
 * @remarks
 * User and system messages contain text; assistant messages also contain tool
 * calls; tool messages attach result metadata. Text is the concatenation of
 * text blocks, so non-text content such as images is not represented here.
 *
 * @see {@link Message}
 */
export const MessageSchema = Type.Union([
  Type.Object(
    {
      /** Speaker for a message that carries only projected text. */
      role: Type.Union([Type.Literal("user"), Type.Literal("system")]),
      /** Text content of the user or system message. */
      text: Type.String(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      /** Identifies content produced by the assistant. */
      role: Type.Literal("assistant"),
      /**
       * Assistant text, which may be empty for a message containing tool calls.
       */
      text: Type.String(),
      /**
       * Tool invocations requested by this message; empty when none were
       * requested.
       */
      toolCalls: Type.Array(ToolCallSchema),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      /** Identifies output returned by a tool invocation. */
      role: Type.Literal("tool"),
      /** Text output returned by the tool. */
      text: Type.String(),
      /** Call identity, error flag, and any available execution metadata. */
      tool: ToolResultSchema,
    },
    { additionalProperties: false },
  ),
]);

/**
 * Validates the model catalog returned by the service, grouped by provider.
 *
 * @remarks
 * The configured default is optional and does not itself guarantee that the
 * referenced model is currently available.
 *
 * @see {@link ModelCatalog}
 */
export const ModelCatalogSchema = Type.Object(
  {
    /** Model used for new conversations that omit an explicit selection. */
    defaultModel: Type.Optional(ModelReferenceSchema),
    /**
     * Configured providers, their known models, and any availability errors.
     */
    providers: Type.Array(ProviderInfoSchema),
  },
  { additionalProperties: false },
);

/**
 * Validates a request to replace the entire tool selection of a conversation.
 *
 * @remarks
 * The runtime accepts this change only when no run or queued work is present;
 * the selected tools apply to the next submission.
 *
 * @see {@link SetToolsInput}
 */
export const SetToolsInputSchema = Type.Object(
  {
    /** Complete replacement selection; an empty array disables all tools. */
    tools: ToolSelectionSchema,
  },
  { additionalProperties: false },
);

/**
 * Validates the registered tools and default selection exposed by the service.
 *
 * @remarks
 * Each entry identifies its owning extension and declares whether interrupted
 * execution can be replayed after the runtime restarts.
 *
 * @see {@link ToolCatalog}
 */
export const ToolCatalogSchema = Type.Object(
  {
    /** Tool names selected for new conversations when `tools` is omitted. */
    defaultTools: ToolSelectionSchema,
    /** Registered tools available for explicit selection. */
    tools: Type.Array(
      Type.Object(
        {
          /** Unique registered name used to select and invoke the tool. */
          name: ToolNameSchema,
          /** Description supplied by the tool registration. */
          description: Type.String(),
          /** Non-empty name of the extension that provides the tool. */
          extension: Type.String({ minLength: 1 }),
          /**
           * Whether an interrupted invocation may rerun after a restart.
           * Registrations without an explicit policy are exposed as `unsafe`.
           */
          replay: Type.Union([Type.Literal("safe"), Type.Literal("unsafe")]),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

/**
 * Validates live progress for a top-level or nested tool invocation.
 *
 * @remarks
 * Pending and running calls have no duration; succeeded and failed calls may
 * report one. A finished slot without a result is projected as `interrupted`.
 * Each status includes a full output snapshot rather than an output delta.
 *
 * @see {@link ToolProgress}
 */
export const ToolProgressSchema = Type.Union([
  /** An invocation waiting for execution to begin. */
  Type.Object(
    { ...toolProgressProperties, status: Type.Literal("pending") },
    { additionalProperties: false },
  ),
  /** An invocation whose execution is in progress. */
  Type.Object(
    { ...toolProgressProperties, status: Type.Literal("running") },
    { additionalProperties: false },
  ),
  /** A finished invocation with a successful result. */
  Type.Object(
    {
      ...toolProgressProperties,
      /** The tool returned a result without its error flag set. */
      status: Type.Literal("succeeded"),
      /** Execution duration in milliseconds, when included in the result. */
      durationMs: ToolResultSchema.properties.durationMs,
    },
    { additionalProperties: false },
  ),
  /** A finished invocation whose result reports an error. */
  Type.Object(
    {
      ...toolProgressProperties,
      /** The tool returned a result with its error flag set. */
      status: Type.Literal("failed"),
      /** Execution duration in milliseconds, when included in the result. */
      durationMs: ToolResultSchema.properties.durationMs,
    },
    { additionalProperties: false },
  ),
  /** A finished invocation for which no result is available. */
  Type.Object(
    { ...toolProgressProperties, status: Type.Literal("interrupted") },
    { additionalProperties: false },
  ),
]);

/**
 * Validates confirmation that an idle conversation's tool selection was saved.
 *
 * @remarks
 * The receipt echoes the full accepted selection and its effective boundary.
 *
 * @see {@link ToolSelectionReceipt}
 */
export const ToolSelectionReceiptSchema = Type.Object(
  {
    /** Conversation whose tool selection changed. */
    conversationId: ConversationIdSchema,
    /** Full list of tool names accepted for subsequent submissions. */
    tools: ToolSelectionSchema,
    /** The next submission uses the updated tool selection. */
    appliesAt: Type.Literal("next_submission"),
  },
  { additionalProperties: false },
);

/**
 * Validates a persisted entry projected into the conversation transcript.
 *
 * @remarks
 * The runtime's entry kind is preserved without a fixed enumeration. Entries
 * may contain multiple messages or an empty array for non-message records.
 *
 * @see {@link ConversationStateSchema}
 */
export const TranscriptEntrySchema = Type.Object(
  {
    /**
     * Persisted identity of this entry, independent of contained tool call IDs.
     */
    id: EntryIdSchema,
    /** Non-empty runtime entry kind describing the record's purpose. */
    kind: Type.String({ minLength: 1 }),
    /** Ordered message projections associated with the entry. */
    messages: Type.Array(MessageSchema),
  },
  { additionalProperties: false },
);

/**
 * Validates the replicated conversation view consumed by clients.
 *
 * @remarks
 * The view combines persisted transcript entries with current configuration,
 * partial generation, tool activity, queued input, and the latest submission's
 * lifecycle. Optional fields are absent when their information is unavailable.
 *
 * @see {@link ConversationState}
 */
export const ConversationStateSchema = Type.Object(
  {
    /**
     * Current identity, title, and creation time of the observed conversation.
     */
    conversation: ConversationSummarySchema,
    /**
     * Configured model, which may differ from an already prepared request's
     * model.
     */
    model: Type.Optional(ModelReferenceSchema),
    /** Names of the tools currently selected for the conversation. */
    selectedTools: ToolSelectionSchema,
    /**
     * Whether a foreground run exists; queued input and background work are
     * separate.
     */
    busy: Type.Boolean(),
    /** Ordered transcript entries exposed by the runtime's current view. */
    entries: Type.Array(TranscriptEntrySchema),
    /**
     * Current assistant text snapshot while generation is represented in live
     * state.
     */
    partial: Type.Optional(Type.String()),
    /** Top-level and nested tool activity currently retained in live state. */
    tools: Type.Array(ToolProgressSchema),
    /** Queued steer and follow-up inputs in inbox order. */
    inbox: Type.Array(QueuedInputSchema),
    /** State of the most recently admitted input, which may still be queued. */
    latestSubmission: Type.Optional(SubmissionStateSchema),
    /**
     * Current runtime, configuration, or generation error, when one is exposed.
     */
    error: Type.Optional(LabErrorSchema),
  },
  { additionalProperties: false },
);

/**
 * Numeric identifier used to address a persisted conversation.
 *
 * @remarks
 * This is an unbranded number. Positivity and safe-integer bounds are enforced
 * by the runtime schema rather than by TypeScript.
 *
 * @see {@link ConversationIdSchema}
 */
export type ConversationId = Static<typeof ConversationIdSchema>;

/**
 * A page of conversation summaries and an optional token for the next page.
 *
 * @remarks
 * Items are returned in descending conversation ID order and exclude deleted
 * conversations.
 *
 * @see {@link ConversationPageSchema}
 */
export type ConversationPage = Static<typeof ConversationPageSchema>;

/**
 * Replicated view of a conversation's transcript, configuration, and live
 * activity.
 *
 * @remarks
 * Includes queued input and the latest submission outcome alongside partial
 * assistant text, tool progress, and any current error.
 *
 * @see {@link ConversationStateSchema}
 */
export type ConversationState = Static<typeof ConversationStateSchema>;

/**
 * Conversation identity, display title, and creation time for lists and views.
 *
 * @remarks
 * Creation time is measured in Unix epoch milliseconds; transcript and activity
 * details belong to {@link ConversationState}.
 *
 * @see {@link ConversationSummarySchema}
 */
export type ConversationSummary = Static<typeof ConversationSummarySchema>;

/**
 * Idempotent conversation creation request with optional model and tool
 * choices.
 *
 * @remarks
 * Omitted choices use runtime defaults. An explicit empty tool array selects no
 * tools, and the request ID must be reused when retrying the creation.
 *
 * @see {@link CreateConversationInputSchema}
 */
export type CreateConversationInput = Static<
  typeof CreateConversationInputSchema
>;

/**
 * Application failure consisting of a machine-readable code and display
 * message.
 *
 * @remarks
 * Errors appear in failed results and in provider or conversation state.
 *
 * @see {@link LabErrorSchema}
 */
export type LabError = Static<typeof LabErrorSchema>;

/**
 * Page size and optional continuation token for listing conversations.
 *
 * @remarks
 * Supply the previous page's `next` token unchanged to continue the scan.
 *
 * @see {@link ListConversationsInputSchema}
 */
export type ListConversationsInput = Static<
  typeof ListConversationsInputSchema
>;

/**
 * Options controlling whether model metadata is refreshed before listing.
 *
 * @remarks
 * Callers supply `refresh` explicitly even though the schema declares a
 * default.
 *
 * @see {@link ListModelsInputSchema}
 */
export type ListModelsInput = Static<typeof ListModelsInputSchema>;

/**
 * Projected transcript message discriminated by user, system, assistant, or
 * tool role.
 *
 * @remarks
 * Assistant messages include tool calls, and tool messages include result
 * metadata. Only textual content is preserved in the shared `text` field.
 *
 * @see {@link MessageSchema}
 */
export type Message = Static<typeof MessageSchema>;

/**
 * Provider-grouped model catalog with an optional configured default selection.
 *
 * @remarks
 * Unavailable models remain visible with their availability flag cleared.
 *
 * @see {@link ModelCatalogSchema}
 */
export type ModelCatalog = Static<typeof ModelCatalogSchema>;

/**
 * Capabilities and credential-dependent availability of a catalog model.
 *
 * @remarks
 * Model IDs are interpreted within the containing provider's catalog entry.
 *
 * @see {@link ModelInfoSchema}
 */
export type ModelInfo = Static<typeof ModelInfoSchema>;

/**
 * Provider and model identifiers forming a complete model selection.
 *
 * @remarks
 * The provider scopes the model ID. Catalog display names are not identifiers.
 *
 * @see {@link ModelReferenceSchema}
 */
export type ModelReference = Static<typeof ModelReferenceSchema>;

/**
 * Saved model selection and the request-preparation boundary where it applies.
 *
 * @remarks
 * A prepared or in-flight request may still use the previous model.
 *
 * @see {@link ModelSelectionReceiptSchema}
 */
export type ModelSelectionReceipt = Static<typeof ModelSelectionReceiptSchema>;

/**
 * Provider metadata, known models, and any discovery or authentication error.
 *
 * @remarks
 * A provider can remain available while reporting a refresh error, so callers
 * should inspect both `available` and `error`.
 *
 * @see {@link ProviderInfoSchema}
 */
export type ProviderInfo = Static<typeof ProviderInfoSchema>;

/**
 * Client-generated deduplication key for creation or input submission.
 *
 * @remarks
 * Keep this string stable across retries; its format and bounds are enforced by
 * the runtime schema rather than by the TypeScript alias.
 *
 * @see {@link RequestIdSchema}
 */
export type RequestId = Static<typeof RequestIdSchema>;

/**
 * Application-level outcome discriminated by the `ok` field.
 *
 * @remarks
 * Narrow on `ok` before reading `value` or `error`. This envelope describes an
 * RPC response; transport failures or cancellation may still reject the call.
 *
 * @typeParam T - Value carried by the successful branch.
 * @see {@link resultSchema}
 */
export type Result<T> =
  | {
      /** Identifies a successful application result. */
      ok: true;
      /** Payload returned by the successful operation. */
      value: T;
    }
  | {
      /** Identifies an application failure. */
      ok: false;
      /** Failure classification and human-readable explanation. */
      error: LabError;
    };

/**
 * Complete replacement model selection for an existing conversation.
 *
 * @remarks
 * The runtime checks availability and applies the selection during subsequent
 * model request preparation.
 *
 * @see {@link SetModelInputSchema}
 */
export type SetModelInput = Static<typeof SetModelInputSchema>;

/**
 * Full replacement tool selection for an idle conversation.
 *
 * @remarks
 * An empty selection disables tools; the runtime rejects unknown names or a
 * change attempted while work is active or queued.
 *
 * @see {@link SetToolsInputSchema}
 */
export type SetToolsInput = Static<typeof SetToolsInputSchema>;

/**
 * Cancellation scope for a conversation's foreground or all owned work.
 *
 * @remarks
 * Foreground cancellation preserves background work; the `all` scope includes
 * it.
 *
 * @see {@link StopInputSchema}
 */
export type StopInput = Static<typeof StopInputSchema>;

/**
 * Confirmation that a conversation's requested cancellation scope completed.
 *
 * @remarks
 * The scope is echoed so callers can distinguish foreground and full stopping.
 *
 * @see {@link StopReceiptSchema}
 */
export type StopReceipt = Static<typeof StopReceiptSchema>;

/**
 * Numeric identity assigned by the runtime to an admitted input.
 *
 * @remarks
 * This unbranded number correlates receipts with inbox entries. It is distinct
 * from the client-generated request key used for retries.
 *
 * @see {@link SubmissionIdSchema}
 */
export type SubmissionId = Static<typeof SubmissionIdSchema>;

/**
 * Admission acknowledgment linking a conversation, submission, and request key.
 *
 * @remarks
 * An admitted submission may still be queued; observe conversation state for
 * subsequent placement and completion.
 *
 * @see {@link SubmissionReceiptSchema}
 */
export type SubmissionReceipt = Static<typeof SubmissionReceiptSchema>;

/**
 * Queueing, placement, completion, or unanswered state of an input submission.
 *
 * @remarks
 * Only the `unanswered` branch carries a reason. Conversation views expose this
 * for the most recent input rather than as a history of all submissions.
 *
 * @see {@link SubmissionStateSchema}
 */
export type SubmissionState = Static<typeof SubmissionStateSchema>;

/**
 * Text input, retry key, and busy policy submitted to a conversation.
 *
 * @remarks
 * Admission can start a run, queue a steer or follow-up, or reject busy input.
 * A successful call returns a receipt before an answer is necessarily
 * available.
 *
 * @see {@link SubmitInputSchema}
 */
export type SubmitInput = Static<typeof SubmitInputSchema>;

/**
 * Assistant-requested invocation with a call ID, tool name, and argument
 * object.
 *
 * @remarks
 * The call ID joins transcript requests to progress and result metadata.
 *
 * @see {@link ToolCallSchema}
 */
export type ToolCall = Static<typeof ToolCallSchema>;

/**
 * Registered tools, owning extensions, replay policies, and default selection.
 *
 * @remarks
 * The defaults are used when creating a conversation without explicit tools.
 *
 * @see {@link ToolCatalogSchema}
 */
export type ToolCatalog = Static<typeof ToolCatalogSchema>;

/**
 * Snapshot of a tool invocation's identity, output, optional details, and
 * status.
 *
 * @remarks
 * Both top-level and nested calls use this union. Duration is available only on
 * succeeded or failed branches and remains optional there.
 *
 * @see {@link ToolProgressSchema}
 */
export type ToolProgress = Static<typeof ToolProgressSchema>;

/**
 * Tool-result metadata containing call identity, error status, and optional
 * details.
 *
 * @remarks
 * Text output is carried by the enclosing tool {@link Message}, while duration
 * is expressed in milliseconds when available.
 *
 * @see {@link ToolResultSchema}
 */
export type ToolResult = Static<typeof ToolResultSchema>;

/**
 * Saved tool selection that will be used by the next submission.
 *
 * @remarks
 * The receipt identifies the conversation and echoes all accepted tool names.
 *
 * @see {@link ToolSelectionReceiptSchema}
 */
export type ToolSelectionReceipt = Static<typeof ToolSelectionReceiptSchema>;

/**
 * Defines commands shared by both conversation contract variants.
 *
 * @remarks
 * Every command returns an application-level {@link Result}. Sharing these
 * descriptors keeps the commands-only and state-bearing variants consistent.
 *
 * @internal
 */
const conversationMethods = {
  /**
   * Describes the RPC that saves a validated provider and model selection.
   *
   * @remarks
   * The selection applies at the next model request preparation, which can
   * occur
   * within the current run. The receipt identifies that effective boundary.
   *
   * @see {@link SetModelInputSchema}
   * @see {@link ModelSelectionReceiptSchema}
   */
  setModel: method(
    Type.Object(
      { id: ConversationIdSchema, input: SetModelInputSchema },
      { additionalProperties: false },
    ),
    resultSchema(ModelSelectionReceiptSchema),
  ),
  /**
   * Describes the RPC that replaces the tool selection of an idle conversation.
   *
   * @remarks
   * Active or queued work produces a busy error; accepted selections take
   * effect
   * on the next submission and are echoed in the receipt.
   *
   * @see {@link SetToolsInputSchema}
   * @see {@link ToolSelectionReceiptSchema}
   */
  setTools: method(
    Type.Object(
      { id: ConversationIdSchema, input: SetToolsInputSchema },
      { additionalProperties: false },
    ),
    resultSchema(ToolSelectionReceiptSchema),
  ),
  /**
   * Describes the RPC that cancels foreground work or includes background work.
   *
   * @remarks
   * The receipt is returned after the runtime's abort operation completes and
   * echoes the requested scope.
   *
   * @see {@link StopInputSchema}
   * @see {@link StopReceiptSchema}
   */
  stop: method(
    Type.Object(
      { id: ConversationIdSchema, input: StopInputSchema },
      { additionalProperties: false },
    ),
    resultSchema(StopReceiptSchema),
  ),
  /**
   * Describes the RPC that admits text input according to its busy policy.
   *
   * @remarks
   * Request IDs deduplicate retries within the conversation. Success confirms
   * admission; subsequent conversation state reports progress and completion.
   *
   * @see {@link SubmitInputSchema}
   * @see {@link SubmissionReceiptSchema}
   */
  submit: method(
    Type.Object(
      { id: ConversationIdSchema, input: SubmitInputSchema },
      { additionalProperties: false },
    ),
    resultSchema(SubmissionReceiptSchema),
  ),
};

/**
 * Builds the application-level result envelope used by the RPC methods.
 *
 * @remarks
 * Success contains `ok: true` and a value matching the supplied schema; failure
 * contains `ok: false` and a {@link LabErrorSchema} error. Each branch rejects
 * additional fields. Transport failures can still reject the RPC itself.
 *
 * @typeParam T - Schema describing the successful payload.
 * @param value - Runtime schema to use for the success branch's `value` field.
 * @returns A discriminated union schema for successful and failed results.
 *
 * @see {@link Result}
 */
export function resultSchema<T extends TSchema>(value: T) {
  return Type.Union([
    Type.Object(
      {
        /** Discriminator identifying a successful response. */
        ok: Type.Literal(true),
        /** Successful payload validated against the caller-supplied schema. */
        value,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        /** Discriminator identifying an application failure. */
        ok: Type.Literal(false),
        /** Structured failure returned by the operation. */
        error: LabErrorSchema,
      },
      { additionalProperties: false },
    ),
  ]);
}

/**
 * Defines the server-hosted contract for one conversation addressed by its ID.
 *
 * @remarks
 * Both variants expose the same commands. The `commands` variant declares no
 * replicated state, while the `default` variant also exposes the live `view`.
 * Command responses use {@link Result} envelopes independently of transport
 * errors and state subscription failures.
 *
 * @see {@link ConversationStateSchema}
 * @see {@link LabService}
 */
export const LabConversation = remote("lab.conversation", {
  /** Chord host responsible for serving conversation objects. */
  host: hostNamed("server"),
  /** Address input selecting the persisted conversation to open. */
  input: Type.Object(
    {
      /** Identifier of the conversation targeted by this remote object. */
      id: ConversationIdSchema,
    },
    { additionalProperties: false },
  ),
  /** Supported conversation member sets. */
  variants: {
    /** Commands-only shape with no replicated conversation state. */
    /** Shared commands for configuration, input submission, and stopping. */
    /** Full shape combining conversation commands with the replicated view. */
    default: {
      /** The same commands exposed by the commands-only variant. */
      /** Replicated values available to conversation subscribers. */
      state: {
        /** Current transcript, selected configuration, and live activity. */
        view: ConversationStateSchema,
      },
    },
  },
  /** Contract version identifying this conversation's wire definition. */
  version: 7,
});

/**
 * Defines the server-hosted service contract for catalogs and conversation
 * lists.
 *
 * @remarks
 * Open the service with an empty input object. Its default variant provides a
 * replicated list revision and methods returning {@link Result} envelopes.
 * Revision changes tell clients to fetch conversation pages again.
 *
 * @see {@link LabConversation}
 */
export const LabService = remote("lab.service", {
  /** Chord host responsible for serving the service. */
  host: hostNamed("server"),
  /** The service accepts an empty address input and rejects extra fields. */
  input: Type.Object({}, { additionalProperties: false }),
  /** Supported member sets exposed by this remote contract. */
  variants: {
    /** Service methods together with conversation-list invalidation state. */
    default: {
      /** Catalog queries and conversation lifecycle operations. */
      methods: {
        ...conversationMethods,
        /**
         * Describes the RPC that creates a conversation using a retry key.
         *
         * @remarks
         * The runtime validates initial model and tool choices and returns the
         * conversation summary. A repeated key resolves to the prior creation.
         *
         * @see {@link CreateConversationInputSchema}
         * @see {@link ConversationSummarySchema}
         */
        createConversation: method(
          CreateConversationInputSchema,
          resultSchema(ConversationSummarySchema),
        ),
        /**
         * Describes the RPC that stops a conversation and marks it deleted.
         *
         * @remarks
         * Accepts the conversation ID directly. Success contains `null`;
         * deleted
         * conversations are excluded from later lists and ordinary operations.
         *
         * @see {@link ConversationIdSchema}
         */
        deleteConversation: method(
          ConversationIdSchema,
          resultSchema(Type.Null()),
        ),
        /**
         * Describes the RPC that pages through non-deleted conversations.
         *
         * @remarks
         * Results use descending ID order and opaque continuation tokens.
         *
         * @see {@link ListConversationsInputSchema}
         * @see {@link ConversationPageSchema}
         */
        listConversations: method(
          ListConversationsInputSchema,
          resultSchema(ConversationPageSchema),
        ),
        /**
         * Describes the RPC that lists providers, models, and availability.
         *
         * @remarks
         * Input controls network refresh. The successful catalog may still
         * contain provider-specific errors and unavailable models.
         *
         * @see {@link ListModelsInputSchema}
         * @see {@link ModelCatalogSchema}
         */
        listModels: method(
          ListModelsInputSchema,
          resultSchema(ModelCatalogSchema),
        ),
        /**
         * Describes the RPC that returns registered tools and their defaults.
         *
         * @remarks
         * Accepts an empty object and returns a result containing the tool
         * catalog.
         *
         * @see {@link ToolCatalogSchema}
         */
        listTools: method(
          Type.Object({}, { additionalProperties: false }),
          resultSchema(ToolCatalogSchema),
        ),
      },
      /** Replicated values available to subscribers of the service. */
      state: {
        /**
         * Revision changed when conversation metadata is created or updated.
         */
        conversations: ConversationListRevisionSchema,
      },
    },
  },
  /** Contract version identifying this service's wire definition. */
  version: 6,
});
