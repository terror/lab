import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Provider } from "@earendil-works/pi-ai";
import { ModelRuntime, SettingsManager } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Check } from "typebox/value";

const ProviderModuleSchema = Type.Object({
  default: Type.Function([Type.Unknown()], Type.Unknown()),
});

const ProvidersSchema = Type.Array(
  Type.Object({ id: Type.String({ minLength: 1, pattern: "\\S" }) }),
);

type ProviderFactory = (options: {
  signal: AbortSignal;
}) => readonly Provider[] | Promise<readonly Provider[]>;

export type ModelConfiguration = {
  modelsPath?: string;
  authPath?: string;
  providerModule?: string;
};

export async function loadModels(
  signal: AbortSignal,
  configuration: ModelConfiguration = {},
) {
  const models = await ModelRuntime.create({
    signal,
    ...(configuration.modelsPath === undefined
      ? {}
      : { modelsPath: configuration.modelsPath }),
    ...(configuration.authPath === undefined
      ? {}
      : { authPath: configuration.authPath }),
    refreshOnCreate: false,
  });

  if (configuration.providerModule !== undefined) {
    const module: unknown = await import(
      pathToFileURL(resolve(configuration.providerModule)).href
    );

    signal.throwIfAborted();

    if (!Check(ProviderModuleSchema, module)) {
      throw new Error(
        "The provider module must default-export a provider factory",
      );
    }

    const { default: factory } = module;

    const providers = await (factory as ProviderFactory)({ signal });

    signal.throwIfAborted();

    if (!Check(ProvidersSchema, providers)) {
      throw new Error(
        "The provider factory must return an array of providers with valid IDs",
      );
    }

    const ids = new Set<string>();

    for (const provider of providers) {
      if (ids.has(provider.id)) {
        throw new Error(`Duplicate custom provider "${provider.id}"`);
      }

      ids.add(provider.id);
    }

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
