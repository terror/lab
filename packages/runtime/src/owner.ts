import type { Context } from "@earendil-works/chord";
import { withoutAbortSignal } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai/models";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import * as pi from "@earendil-works/pi-durable";
import { Check } from "typebox/value";
import { HarnessRuntime } from "./conversations";
import {
  type Configuration,
  ConfigurationDoc,
  ConfigurationSchema,
  ConversationDoc,
} from "./metadata";
import { openHarness, openStorage } from "./pi";
import type { RuntimeOwner } from "./runtime";

export type RuntimeOptions = {
  path: string;
  model?: pi.ModelRef;
  models?: pi.HarnessOptions["models"];
  extensions?: readonly pi.Extension[];
  onReport?: (error: unknown) => void;
};

export async function openRuntime(
  options: RuntimeOptions,
  context: Context,
): Promise<RuntimeOwner> {
  context.abortSignal?.throwIfAborted();

  const models = options.models ?? defaultModels();
  const extensions = options.extensions ?? [];
  const registry = pi.createRegistry();

  for (const extension of extensions) {
    registry.install(extension);
  }

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
    const configuration = resolveConfiguration(stored?.configuration, options);

    if (
      models.getModel(
        configuration.model.provider,
        configuration.model.modelId,
      ) === undefined
    ) {
      throw new Error(
        `Model ${configuration.model.provider}/${configuration.model.modelId} is unavailable`,
      );
    }

    if (
      (await models.checkAuth(configuration.model.provider, {
        signal: context.abortSignal,
      })) === undefined
    ) {
      throw new Error(
        `Provider ${configuration.model.provider} has no configured credentials`,
      );
    }

    if (stored?.configuration == null) {
      await harness.commit(async (tx) => {
        (await tx.doc(ConfigurationDoc)).configuration = configuration;
      }, context);
    }

    context.abortSignal?.throwIfAborted();

    const runtime = new HarnessRuntime(
      harness,
      storage,
      configuration,
      extensions,
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
): Configuration {
  const extensions = (options.extensions ?? []).map(({ name }) => name);
  const configuration = stored ?? { model: options.model, extensions };

  if (!Check(ConfigurationSchema, configuration)) {
    throw new Error("A valid provider and model must be configured");
  }

  if (
    options.model !== undefined &&
    (options.model.provider !== configuration.model.provider ||
      options.model.modelId !== configuration.model.modelId)
  ) {
    throw new Error("Configured model differs from the stored model");
  }

  if (
    extensions.length !== configuration.extensions.length ||
    extensions.some((name, index) => name !== configuration.extensions[index])
  ) {
    throw new Error("Configured extensions differ from the stored extensions");
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
