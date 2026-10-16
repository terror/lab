import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ModelRuntime, SettingsManager } from "@earendil-works/pi-coding-agent";
import { omitUndefined } from "@lab/contracts";
import type { ProviderFactory } from "@lab/runtime";

export type ModelConfiguration = {
  modelsPath?: string;
  authPath?: string;
  providerModule?: string;
};

export async function loadModels(
  signal: AbortSignal,
  configuration: ModelConfiguration = {},
) {
  const models = await ModelRuntime.create(
    omitUndefined({
      signal,
      modelsPath: configuration.modelsPath,
      authPath: configuration.authPath,
      refreshOnCreate: false,
    }),
  );

  if (configuration.providerModule !== undefined) {
    const module = await import(
      pathToFileURL(resolve(configuration.providerModule)).href
    );

    signal.throwIfAborted();

    if (typeof module.default !== "function") {
      throw new Error(
        "The provider module must default-export a provider factory",
      );
    }

    const factory = module.default as ProviderFactory;
    const providers = await factory({ signal });

    signal.throwIfAborted();

    if (!Array.isArray(providers)) {
      throw new Error("The provider factory must return an array of providers");
    }

    const ids = new Set<string>();

    for (const provider of providers) {
      if (ids.has(provider.id)) {
        throw new Error(`Duplicate custom provider "${provider.id}"`);
      }

      ids.add(provider.id);
      models.registerNativeProvider(provider);
    }
  }

  signal.throwIfAborted();

  const error = models.getError();

  if (error !== undefined) {
    throw new Error(error);
  }

  await models.refresh({ allowNetwork: false, signal });

  signal.throwIfAborted();

  return models;
}

export function loadDefaultModel() {
  const settings = SettingsManager.create(process.cwd(), undefined, {
    projectTrusted: false,
  });

  const errors = settings.drainErrors();

  if (errors.length > 0) {
    throw new AggregateError(
      errors.map(({ error }) => error),
      "Failed to load Pi settings",
    );
  }

  const provider = settings.getDefaultProvider();
  const modelId = settings.getDefaultModel();

  return provider === undefined || modelId === undefined
    ? undefined
    : { provider, modelId };
}
