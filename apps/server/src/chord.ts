import { ChordError, createHost } from "@earendil-works/chord";
import {
  BACKGROUND_CONTEXT,
  withAbortSignal,
} from "@earendil-works/chord/context";
import { LabConversation, LabService } from "@lab/contracts";
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
      listConversations: (input, context) => {
        sessions.authorize(principal);
        return runtime.listConversations(input, callContext(context));
      },
      createConversation: (input, context) => {
        sessions.authorize(principal);
        return runtime.createConversation(input, callContext(context));
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

        if (!result.ok) {
          throw new ChordError(
            result.error.code === "not_found" ? "gone" : "unavailable",
            result.error.message,
            { reason: result.error.code },
          );
        }

        return result.value;
      },
    });

    return {
      variant: "commands",
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
