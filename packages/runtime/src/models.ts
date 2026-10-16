import type { Context } from "@earendil-works/chord";
import type { Api, Model, Models } from "@earendil-works/pi-ai";
import type {
  ListModelsInput,
  ModelCatalog,
  ModelReference,
  ProviderInfo,
  Result,
} from "@lab/wire";

export class ModelRegistry {
  constructor(private readonly models: Models) {}

  async list(
    defaultModel: ModelReference | undefined,
    input: ListModelsInput,
    context: Context,
  ): Promise<ModelCatalog> {
    const refreshed = input.refresh
      ? await this.models.refresh({
          allowNetwork: true,
          ...(context.abortSignal === undefined
            ? {}
            : { signal: context.abortSignal }),
        })
      : undefined;

    context.abortSignal?.throwIfAborted();

    const providers = await Promise.all(
      this.models
        .getProviders()
        .map(async (provider): Promise<ProviderInfo> => {
          const result = await this.available(provider.id, context);
          const available = new Set(
            result.ok ? result.value.map(({ id }) => id) : [],
          );
          const error = !result.ok
            ? result.error
            : refreshed?.errors.has(provider.id)
              ? {
                  code: "provider_unavailable" as const,
                  message: `Unable to refresh models for provider "${provider.id}".`,
                }
              : undefined;

          return {
            id: provider.id,
            name: provider.name,
            available: result.ok,
            models: this.models.getModels(provider.id).map((model) => ({
              id: model.id,
              name: model.name,
              contextWindow: model.contextWindow,
              maxTokens: model.maxTokens,
              reasoning: model.reasoning,
              input: [...model.input],
              available: available.has(model.id),
            })),
            ...(error === undefined ? {} : { error }),
          };
        }),
    );

    return {
      ...(defaultModel === undefined
        ? {}
        : { defaultModel: { ...defaultModel } }),
      providers,
    };
  }

  async validate(
    model: ModelReference | undefined,
    context: Context,
  ): Promise<Result<ModelReference>> {
    context.abortSignal?.throwIfAborted();

    if (model === undefined) {
      return {
        ok: false,
        error: {
          code: "model_unavailable",
          message: "Select a model for this conversation.",
        },
      };
    }

    if (this.models.getProvider(model.provider) === undefined) {
      return {
        ok: false,
        error: {
          code: "provider_unavailable",
          message: `Provider "${model.provider}" is not configured.`,
        },
      };
    }

    if (this.models.getModel(model.provider, model.modelId) === undefined) {
      return {
        ok: false,
        error: {
          code: "model_unavailable",
          message: `Model "${model.provider}/${model.modelId}" is unavailable.`,
        },
      };
    }

    const available = await this.available(model.provider, context);

    if (!available.ok) {
      return available;
    }

    if (!available.value.some(({ id }) => id === model.modelId)) {
      return {
        ok: false,
        error: {
          code: "model_unavailable",
          message: `Model "${model.provider}/${model.modelId}" is unavailable with the configured credentials.`,
        },
      };
    }

    return { ok: true, value: { ...model } };
  }

  private async available(
    provider: string,
    context: Context,
  ): Promise<Result<readonly Model<Api>[]>> {
    try {
      const options =
        context.abortSignal === undefined
          ? {}
          : { signal: context.abortSignal };

      if ((await this.models.checkAuth(provider, options)) === undefined) {
        return {
          ok: false,
          error: {
            code: "provider_unavailable",
            message: `Provider "${provider}" has no configured credentials.`,
          },
        };
      }

      const value = await this.models.getAvailable(provider, options);
      context.abortSignal?.throwIfAborted();
      return { ok: true, value };
    } catch {
      context.abortSignal?.throwIfAborted();

      return {
        ok: false,
        error: {
          code: "provider_unavailable",
          message: `Unable to resolve credentials or models for provider "${provider}".`,
        },
      };
    }
  }
}
