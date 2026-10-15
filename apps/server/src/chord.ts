import { ChordError, createHost } from "@earendil-works/chord";
import {
  BACKGROUND_CONTEXT,
  withAbortSignal,
} from "@earendil-works/chord/context";
import { LabConversation, LabService } from "@lab/contracts";
import { callContext, type Runtime } from "@lab/runtime";

export function createLabHost(runtime: Runtime) {
  const host = createHost({ name: "server", self: { kind: "server" } });

  host.serve(LabService, () => ({
    variant: "default",
    listConversations: (input, context) =>
      runtime.listConversations(input, callContext(context)),
    createConversation: (input, context) =>
      runtime.createConversation(input, callContext(context)),
  }));

  host.serve(LabConversation, ({ id }, _principal, self) => {
    const conversation = self.resource("conversation", {
      version: 1,
      open: async ({ signal }) => {
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
      submit: (input, context) =>
        conversation.value.submit(input, callContext(context)),
      stop: (input, context) =>
        conversation.value.stop(input, callContext(context)),
    };
  });

  return host;
}
