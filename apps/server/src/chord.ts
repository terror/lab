import {
  ChordError,
  type Context,
  type Ctx,
  createHost,
} from "@earendil-works/chord";
import {
  BACKGROUND_CONTEXT,
  withAbortSignal,
} from "@earendil-works/chord/context";
import type { Runtime } from "@lab/runtime";
import {
  ConversationListRevisionSchema,
  ConversationStateSchema,
  LabConversation,
  LabService,
  type Result,
} from "@lab/wire";
import type { Principal, Sessions } from "./auth";

export function createLabHost(runtime: Runtime, sessions: Sessions) {
  const host = createHost<Principal>({
    name: "server",
    self: { kind: "server" },
    principalKey: (principal) =>
      principal.kind === "server" ? "server" : `browser:${principal.sessionId}`,
  });

  host.serve(LabService, (_input, principal, self) => {
    sessions.authorize(principal);

    function authorize(context: Ctx): Context {
      sessions.authorize(principal);
      return withAbortSignal(context.signal, BACKGROUND_CONTEXT);
    }

    const conversations = self.state(
      "conversations",
      ConversationListRevisionSchema,
      0,
    );

    self.on(
      "conversations",
      {
        subscribe: (listener: (revision: number) => void) =>
          runtime.subscribeConversations(listener),
      },
      (revision, context) => {
        sessions.authorize(principal);
        conversations.replace(context, revision);
      },
    );

    return {
      variant: "default",
      conversations,
      deleteConversation: (id, context) =>
        runtime.deleteConversation(id, authorize(context)),
      listConversations: (input, context) =>
        runtime.listConversations(input, authorize(context)),
      listModels: (input, context) =>
        runtime.listModels(input, authorize(context)),
      listTools: (_input, context) => runtime.listTools(authorize(context)),
      setModel: ({ id, input }, context) =>
        runtime.setModel(id, input, authorize(context)),
      setTools: ({ id, input }, context) =>
        runtime.setTools(id, input, authorize(context)),
      startConversation: (input, context) =>
        runtime.startConversation(input, authorize(context)),
      stop: ({ id, input }, context) =>
        runtime.stop(id, input, authorize(context)),
      submit: ({ id, input }, context) =>
        runtime.submit(id, input, authorize(context)),
    };
  });

  host.serve(LabConversation, ({ id }, principal, self) => {
    sessions.authorize(principal);

    const observation = self.resource("observation", {
      version: 1,
      open: async ({ signal }) => {
        sessions.authorize(principal);

        return unwrap(
          await runtime.observeConversation(
            id,
            withAbortSignal(signal, BACKGROUND_CONTEXT),
          ),
        );
      },
      close: (observation) => observation.dispose(),
    });

    const view = self.state("view", ConversationStateSchema, {
      init: () => observation.value.value,
    });

    self.on("view", observation, (value, context) => {
      sessions.authorize(principal);
      view.replace(context, value, { diff: true });
    });

    return {
      variant: "default",
      view,
    };
  });

  return host;
}

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new ChordError(
      result.error.code === "not_found" ? "gone" : "unavailable",
      result.error.message,
      { reason: result.error.code },
    );
  }

  return result.value;
}
