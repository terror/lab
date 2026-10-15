import type { ModelCatalog, ModelReference } from "@lab/contracts";

export function modelKey(model: ModelReference | undefined) {
  return model === undefined
    ? ""
    : JSON.stringify([model.provider, model.modelId]);
}

export function modelAvailable(
  catalog: ModelCatalog | undefined,
  model: ModelReference | undefined,
) {
  return (
    catalog?.providers.some(
      (provider) =>
        provider.id === model?.provider &&
        provider.available &&
        provider.models.some(
          ({ id, available }) => id === model.modelId && available,
        ),
    ) ?? false
  );
}
