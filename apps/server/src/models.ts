import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ModelRuntime, SettingsManager } from "@earendil-works/pi-coding-agent";
import { omitUndefined } from "@lab/contracts";
import { loadProviders } from "@lab/runtime";

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
    const module: unknown = await import(
      pathToFileURL(resolve(configuration.providerModule)).href
    );

    const providers = await loadProviders(module, signal);

    for (const provider of providers) {
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
