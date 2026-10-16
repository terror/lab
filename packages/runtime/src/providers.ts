import { Type } from "typebox";
import type { ProviderFactory } from "./models";
import { validate } from "./validation";

const ProviderModuleSchema = Type.Object({
  default: Type.Function([Type.Unknown()], Type.Unknown()),
});

const ProvidersSchema = Type.Array(
  Type.Object({ id: Type.String({ minLength: 1, pattern: "\\S" }) }),
);

export async function loadProviders(module: unknown, signal: AbortSignal) {
  signal.throwIfAborted();

  const { default: factory } = validate(
    ProviderModuleSchema,
    module,
    "The provider module must default-export a provider factory",
  );

  const providers = await (factory as ProviderFactory)({ signal });

  signal.throwIfAborted();

  validate(
    ProvidersSchema,
    providers,
    "The provider factory must return an array of providers with valid IDs",
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
