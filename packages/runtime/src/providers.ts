import type { ApiKeyAuth, OAuthAuth, Provider } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { functionSchema, validate } from "./validation";

const ProviderModuleSchema = Type.Object({
  default: Type.Function([Type.Unknown()], Type.Unknown()),
});

const ProviderSchema = Type.Object({
  id: Type.String({ minLength: 1, pattern: "\\S" }),
  name: Type.String(),
  baseUrl: Type.Optional(Type.String()),
  headers: Type.Optional(
    Type.Record(Type.String(), Type.Union([Type.String(), Type.Null()])),
  ),
  auth: Type.Object(
    {
      apiKey: Type.Optional(
        Type.Object({
          name: Type.String(),
          login: Type.Optional(
            functionSchema<NonNullable<ApiKeyAuth["login"]>>(),
          ),
          check: Type.Optional(
            functionSchema<NonNullable<ApiKeyAuth["check"]>>(),
          ),
          resolve: functionSchema<ApiKeyAuth["resolve"]>(),
        }),
      ),
      oauth: Type.Optional(
        Type.Object({
          name: Type.String(),
          isSubscription: Type.Optional(Type.Boolean()),
          loginLabel: Type.Optional(Type.String()),
          login: functionSchema<OAuthAuth["login"]>(),
          refresh: functionSchema<OAuthAuth["refresh"]>(),
          toAuth: functionSchema<OAuthAuth["toAuth"]>(),
        }),
      ),
    },
    { anyOf: [{ required: ["apiKey"] }, { required: ["oauth"] }] },
  ),
  getModels: functionSchema<Provider["getModels"]>(),
  getAllModels: Type.Optional(
    functionSchema<NonNullable<Provider["getAllModels"]>>(),
  ),
  refreshModels: Type.Optional(
    functionSchema<NonNullable<Provider["refreshModels"]>>(),
  ),
  filterModels: Type.Optional(
    functionSchema<NonNullable<Provider["filterModels"]>>(),
  ),
  filterAllModels: Type.Optional(
    functionSchema<NonNullable<Provider["filterAllModels"]>>(),
  ),
  stream: functionSchema<Provider["stream"]>(),
  streamSimple: functionSchema<Provider["streamSimple"]>(),
  fetchDeferred: Type.Optional(
    functionSchema<NonNullable<Provider["fetchDeferred"]>>(),
  ),
  cancelDeferred: Type.Optional(
    functionSchema<NonNullable<Provider["cancelDeferred"]>>(),
  ),
  generateImages: Type.Optional(
    functionSchema<NonNullable<Provider["generateImages"]>>(),
  ),
  classify: Type.Optional(functionSchema<NonNullable<Provider["classify"]>>()),
});

const ProvidersSchema = Type.Array(ProviderSchema);

export async function loadProviders(module: unknown, signal: AbortSignal) {
  signal.throwIfAborted();

  const { default: factory } = validate(
    ProviderModuleSchema,
    module,
    "The provider module must default-export a provider factory",
  );

  const value = await factory({ signal });

  signal.throwIfAborted();

  const providers = validate(
    ProvidersSchema,
    value,
    "The provider factory must return an array of valid providers",
  );

  const ids = new Set<string>();

  for (const provider of providers) {
    if (ids.has(provider.id)) {
      throw new Error(`Duplicate custom provider "${provider.id}"`);
    }

    ids.add(provider.id);
  }

  return providers;
}
