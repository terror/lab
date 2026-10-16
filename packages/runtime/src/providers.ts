import { Type } from "typebox";
import { Check } from "typebox/value";
import type { ProviderFactory } from "./models";

const ProviderModuleSchema = Type.Object({
  default: Type.Function([Type.Unknown()], Type.Unknown()),
});

const ProvidersSchema = Type.Array(
  Type.Object({ id: Type.String({ minLength: 1, pattern: "\\S" }) }),
);

export async function loadProviders(module: unknown, signal: AbortSignal) {
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

  return providers;
}
