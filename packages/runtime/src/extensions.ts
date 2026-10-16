import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Context } from "@earendil-works/chord";
import type * as pi from "@earendil-works/pi-durable";
import { ToolNameSchema } from "@lab/wire";
import { Type } from "typebox";
import { Compile } from "typebox/compile";
import { Check } from "typebox/value";
import { ToolRegistry } from "./tool-registry";

const ModulePathsSchema = Type.Array(Type.String({ minLength: 1 }), {
  uniqueItems: true,
});

const ModuleSchema = Type.Object({ default: Type.Unknown() });

const ExtensionRequirementsSchema = Type.Object({
  name: Type.String({
    minLength: 1,
    maxLength: 128,
    pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$",
  }),
  tools: Type.Optional(
    Type.Array(
      Type.Object({
        name: ToolNameSchema,
        parameters: Type.Object({ type: Type.Literal("object") }),
        structuredOutputSchema: Type.Optional(
          Type.Union([Type.Boolean(), Type.Object({})]),
        ),
      }),
    ),
  ),
});

export async function loadExtensions(
  paths: unknown,
  definitions: readonly pi.Extension[],
  registry: pi.Registry,
  context: Context,
) {
  if (!Check(ModulePathsSchema, paths)) {
    throw new Error(
      "Extension modules must be an array of non-empty file paths",
    );
  }

  const modules = paths.map((path) => resolve(path));

  if (new Set(modules).size !== modules.length) {
    throw new Error("Duplicate extension module paths");
  }

  const extensions = definitions.map(validateExtension);

  for (const path of modules) {
    context.abortSignal?.throwIfAborted();

    try {
      const module: unknown = await import(pathToFileURL(path).href);

      context.abortSignal?.throwIfAborted();

      if (!Check(ModuleSchema, module)) {
        throw new Error(
          "The extension module must default-export a Pi extension",
        );
      }

      const { default: extension } = module;

      extensions.push(validateExtension(extension as pi.Extension));
    } catch (cause) {
      context.abortSignal?.throwIfAborted();
      throw new Error(`Failed to load extension module "${path}"`, { cause });
    }
  }

  for (const extension of extensions) {
    if (registry.snapshot().extension(extension.name) !== undefined) {
      throw new Error(`Duplicate extension "${extension.name}"`);
    }

    registry.install(extension);
  }

  context.abortSignal?.throwIfAborted();

  return new ToolRegistry(extensions, modules);
}

function validateExtension(extension: pi.Extension) {
  if (!Check(ExtensionRequirementsSchema, extension)) {
    throw new Error(
      "Expected a Pi extension with valid names and tool schemas",
    );
  }

  for (const tool of extension.tools ?? []) {
    try {
      Compile(tool.parameters);

      if (tool.structuredOutputSchema !== undefined) {
        Compile(tool.structuredOutputSchema);
      }
    } catch (cause) {
      throw new Error(`Invalid schema for tool "${tool.name}"`, { cause });
    }
  }

  return extension;
}
