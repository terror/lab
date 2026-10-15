import { ModelRuntime, SettingsManager } from "@earendil-works/pi-coding-agent";

export async function loadModels(signal: AbortSignal) {
  const models = await ModelRuntime.create({ signal });

  signal.throwIfAborted();

  const error = models.getError();

  if (error !== undefined) {
    throw new Error(error);
  }

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
