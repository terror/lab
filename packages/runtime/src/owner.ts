import type { Context } from "@earendil-works/chord";
import { withoutAbortSignal } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai/models";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import * as pi from "@earendil-works/pi-durable";
import { Check } from "typebox/value";
import { HarnessRuntime } from "./conversations";
import { loadExtensions, type ToolRegistry } from "./extensions";
import {
  type Configuration,
  ConfigurationDoc,
  ConfigurationSchema,
  ConversationDoc,
} from "./metadata";
import { ModelRegistry } from "./models";
import { openHarness, openStorage } from "./pi";
import type { RuntimeOwner } from "./runtime";
import { TitleExtension } from "./titles";

export type RuntimeOptions = {
  path: string;
  model?: pi.ModelRef;
  defaultModel?: pi.ModelRef;
  models?: pi.HarnessOptions["models"];
  extensions?: readonly pi.Extension[];
  extensionModules?: readonly string[];
  onReport?: (error: unknown) => void;
};

export async function openRuntime(
  options: RuntimeOptions,
  context: Context,
): Promise<RuntimeOwner> {
  context.abortSignal?.throwIfAborted();

  const models = options.models ?? defaultModels();
  const extensions: pi.Extension[] = [];
  const registry = pi.createRegistry();
  registry.install(TitleExtension);

  const storage = await openStorage(options.path);

  const harness = await (async () => {
    try {
      return await openHarness(
        storage,
        {
          models,
          registry,
          settings: { extensions },
          conversationCreated: async (tx, conversation) => {
            await tx.doc(ConversationDoc, conversation.id);
          },
          onReport: options.onReport,
        },
        context,
      );
    } catch (error) {
      await closeAfterFailure(error, () =>
        storage.close(withoutAbortSignal(context)),
      );

      throw error;
    }
  })();

  try {
    const stored = await harness.snapshot(ConfigurationDoc, context);

    if (
      stored?.configuration != null &&
      !Check(ConfigurationSchema, stored.configuration)
    ) {
      throw new Error("Invalid stored runtime configuration");
    }

    const tools = await loadExtensions(
      options.extensionModules === undefined
        ? (stored?.configuration?.extensionModules ?? [])
        : options.extensionModules,
      options.extensions ?? [],
      registry,
      context,
    );
    extensions.push(...tools.extensions);
    const configuration = resolveConfiguration(
      stored?.configuration,
      options,
      tools,
    );

    if (
      JSON.stringify(stored?.configuration) !== JSON.stringify(configuration)
    ) {
      await harness.commit(async (tx) => {
        (await tx.doc(ConfigurationDoc)).configuration = configuration;
      }, context);
    }

    context.abortSignal?.throwIfAborted();

    const runtime = new HarnessRuntime(
      harness,
      storage,
      configuration,
      tools,
      new ModelRegistry(models),
    );

    harness.resume();

    return {
      runtime,
      closed: harness.closed,
      close: (context) => harness.close(withoutAbortSignal(context)),
    };
  } catch (error) {
    await closeAfterFailure(error, () =>
      harness.close(withoutAbortSignal(context)),
    );

    throw error;
  }
}

function defaultModels() {
  const models = createModels();
  models.setProvider(openaiProvider());
  return models;
}

function resolveConfiguration(
  stored: Configuration | null | undefined,
  options: RuntimeOptions,
  tools: ToolRegistry,
): Configuration {
  const model = options.model ?? stored?.model ?? options.defaultModel;
  const configuration = {
    ...tools.configuration(stored),
    ...(model === undefined ? {} : { model }),
  };

  if (!Check(ConfigurationSchema, configuration)) {
    throw new Error("Invalid runtime configuration");
  }

  return configuration;
}

async function closeAfterFailure(error: unknown, close: () => Promise<void>) {
  try {
    await close();
  } catch (closeError) {
    throw new AggregateError(
      [error, closeError],
      "Runtime initialization failed and close failed",
    );
  }
}
