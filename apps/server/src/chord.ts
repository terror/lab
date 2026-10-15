import { ChordError, createHost } from "@earendil-works/chord";
import {
  BACKGROUND_CONTEXT,
  withAbortSignal,
} from "@earendil-works/chord/context";
import {
  ConversationStateSchema,
  LabConversation,
  LabService,
  type Result,
} from "@lab/contracts";
import { callContext, type Runtime } from "@lab/runtime";
import type { Principal, Sessions } from "./auth";

export function createLabHost(runtime: Runtime, sessions: Sessions) {
  const host = createHost<Principal>({
    name: "server",
    self: { kind: "server" },
    principalKey: (principal) =>
      principal.kind === "server" ? "server" : `browser:${principal.sessionId}`,
  });

  host.serve(LabService, (_input, principal) => {
    sessions.authorize(principal);

    return {
      variant: "default",
      listTools: (_input, context) => {
        sessions.authorize(principal);
        return runtime.listTools(callContext(context));
      },
      listModels: (input, context) => {
        sessions.authorize(principal);
        return runtime.listModels(input, callContext(context));
      },
      listConversations: (input, context) => {
        sessions.authorize(principal);
        return runtime.listConversations(input, callContext(context));
      },
      createConversation: (input, context) => {
        sessions.authorize(principal);
        return runtime.createConversation(input, callContext(context));
      },
      deleteConversation: (id, context) => {
        sessions.authorize(principal);
        return runtime.deleteConversation(id, callContext(context));
      },
    };
  });

  host.serve(LabConversation, ({ id }, principal, self) => {
    sessions.authorize(principal);

    const conversation = self.resource("conversation", {
      version: 1,
      open: async ({ signal }) => {
        sessions.authorize(principal);

        const result = await runtime.conversation(
          id,
          withAbortSignal(signal, BACKGROUND_CONTEXT),
        );

        return unwrap(result);
      },
    });

    const observation = self.resource("observation", {
      version: 1,
      deps: [conversation],
      open: async ({ signal }) => {
        sessions.authorize(principal);

        return unwrap(
          await conversation.value.observe(
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
      setTools: (input, context) => {
        sessions.authorize(principal);
        return conversation.value.setTools(input, callContext(context));
      },
      setModel: (input, context) => {
        sessions.authorize(principal);
        return conversation.value.setModel(input, callContext(context));
      },
      submit: (input, context) => {
        sessions.authorize(principal);
        return conversation.value.submit(input, callContext(context));
      },
      stop: (input, context) => {
        sessions.authorize(principal);
        return conversation.value.stop(input, callContext(context));
      },
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
