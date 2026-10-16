import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Context } from "@earendil-works/chord";
import type * as pi from "@earendil-works/pi-durable";
import {
  type LabError,
  type Result,
  type ToolCatalog,
  ToolNameSchema,
} from "@lab/contracts";
import { Type } from "typebox";
import { Compile } from "typebox/compile";
import type { Configuration } from "./metadata";
import { functionSchema, validate } from "./validation";

const ModulePathsSchema = Type.Array(Type.String({ minLength: 1 }), {
  uniqueItems: true,
});

const ModuleSchema = Type.Object({ default: Type.Unknown() });

const ExtensionSchema = Type.Object({
  name: Type.String({
    minLength: 1,
    maxLength: 128,
    pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$",
  }),
  tools: Type.Optional(
    Type.Array(
      Type.Object({
        name: ToolNameSchema,
        description: Type.String(),
        parameters: Type.Object({ type: Type.Literal("object") }),
        constrainedSampling: Type.Optional(
          Type.Union([
            Type.Literal(false),
            Type.Object({
              type: Type.Literal("json_schema"),
              strict: Type.Union([
                Type.Literal("prefer"),
                Type.Literal("require"),
              ]),
            }),
            Type.Object({
              type: Type.Literal("grammar"),
              variants: Type.Object({
                openai_lark: Type.Optional(Type.String()),
                openai_regex: Type.Optional(Type.String()),
              }),
            }),
          ]),
        ),
        execute: functionSchema<pi.ToolRegistration["execute"]>(),
        replay: Type.Optional(
          Type.Union([Type.Literal("safe"), Type.Literal("unsafe")]),
        ),
        executionMode: Type.Optional(
          Type.Union([Type.Literal("parallel"), Type.Literal("sequential")]),
        ),
        prepareArguments: Type.Optional(
          functionSchema<
            NonNullable<pi.ToolRegistration["prepareArguments"]>
          >(),
        ),
        structuredOutputSchema: Type.Optional(
          Type.Union([Type.Boolean(), Type.Object({})]),
        ),
        callers: Type.Optional(
          Type.Array(
            Type.Union([Type.Literal("model"), Type.Literal("tools")]),
          ),
        ),
        deferred: Type.Optional(Type.Literal(true)),
        outputLimits: Type.Optional(
          Type.Object({
            maxBytes: Type.Optional(Type.Number()),
            maxLines: Type.Optional(Type.Number()),
            retain: Type.Optional(
              Type.Union([Type.Literal("head"), Type.Literal("tail")]),
            ),
          }),
        ),
      }),
    ),
  ),
  tasks: Type.Optional(
    Type.Array(
      Type.Object({
        definition: Type.Object({
          name: Type.String({ minLength: 1 }),
          version: Type.Integer({ minimum: 1 }),
          initial: Type.Function([Type.Unknown()], Type.Unknown()),
          phases: Type.Record(Type.String(), Type.Function([], Type.Unknown())),
          abort: Type.Function([], Type.Unknown()),
          migrate: Type.Optional(Type.Function([], Type.Unknown())),
          hooks: Type.Optional(Type.Object({})),
        }),
      }),
    ),
  ),
  hooks: Type.Optional(
    Type.Array(
      Type.Object({
        task: Type.String(),
        handlers: Type.Object({}),
      }),
    ),
  ),
  sections: Type.Optional(
    Type.Array(
      Type.Object({
        key: Type.String(),
        render: functionSchema<pi.PromptSection["render"]>(),
        tag: Type.Optional(Type.Boolean()),
      }),
    ),
  ),
  wraps: Type.Optional(
    Type.Array(
      Type.Union([
        Type.Object({
          tool: Type.String(),
          wrap: functionSchema<
            (tool: pi.ToolRegistration) => pi.ToolRegistration
          >(),
        }),
        Type.Object({
          section: Type.String(),
          wrap: functionSchema<
            (section: pi.PromptSection) => pi.PromptSection
          >(),
        }),
      ]),
    ),
  ),
});

export async function loadExtensions(
  paths: unknown,
  definitions: readonly unknown[],
  registry: pi.Registry,
  context: Context,
) {
  const modules = validate(
    ModulePathsSchema,
    paths,
    "Extension modules must be an array of non-empty file paths",
  ).map((path) => resolve(path));

  if (new Set(modules).size !== modules.length) {
    throw new Error("Duplicate extension module paths");
  }

  const extensions = definitions.map(validateExtension);

  for (const path of modules) {
    context.abortSignal?.throwIfAborted();

    try {
      const module: unknown = await import(pathToFileURL(path).href);

      context.abortSignal?.throwIfAborted();

      const { default: extension } = validate(
        ModuleSchema,
        module,
        "The extension module must default-export a Pi extension",
      );

      extensions.push(validateExtension(extension));
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

export class ToolRegistry {
  private readonly tools: Map<
    string,
    { extension: pi.Extension; tool: pi.ToolRegistration }
  >;

  constructor(
    readonly extensions: readonly pi.Extension[],
    readonly modules: readonly string[],
  ) {
    this.tools = new Map();

    for (const extension of extensions) {
      for (const tool of extension.tools ?? []) {
        if (this.tools.has(tool.name)) {
          throw new Error(`Duplicate tool "${tool.name}"`);
        }

        this.tools.set(tool.name, { extension, tool });
      }
    }
  }

  configuration(stored: Configuration | null | undefined) {
    const extensions = this.extensions.map(({ name }) => name);

    const toolDefinitions = [...this.tools.values()].map(
      ({ extension, tool }) => ({ name: tool.name, extension: extension.name }),
    );

    const taskDefinitions = this.extensions.flatMap((extension) =>
      (extension.tasks ?? []).map(({ definition }) => ({
        name: definition.name,
        extension: extension.name,
      })),
    );

    for (const name of stored?.extensions ?? []) {
      if (!extensions.includes(name)) {
        throw new Error(`Stored extension "${name}" is not configured`);
      }
    }

    for (const [kind, previous, current] of [
      ["tool", stored?.toolDefinitions ?? [], toolDefinitions],
      ["task", stored?.taskDefinitions ?? [], taskDefinitions],
    ] as const) {
      for (const definition of previous) {
        if (
          !current.some(
            ({ name, extension }) =>
              name === definition.name && extension === definition.extension,
          )
        ) {
          throw new Error(
            `Stored ${kind} "${definition.name}" from extension "${definition.extension}" is not configured`,
          );
        }
      }
    }

    return {
      extensions,
      extensionModules: [...this.modules],
      toolDefinitions,
      taskDefinitions,
    };
  }

  catalog(): ToolCatalog {
    return {
      defaultTools: [...this.tools.keys()],
      tools: [...this.tools.values()].map(({ extension, tool }) => ({
        name: tool.name,
        description: tool.description,
        extension: extension.name,
        replay: tool.replay ?? "unsafe",
      })),
    };
  }

  select(names: readonly string[]): Result<readonly pi.ToolRegistration[]> {
    const tools: pi.ToolRegistration[] = [];

    for (const name of names) {
      const definition = this.tools.get(name);

      if (definition === undefined) {
        return {
          ok: false,
          error: {
            code: "tool_unavailable",
            message: `Tool "${name}" is not available in the configured extensions.`,
          },
        };
      }

      tools.push(definition.tool);
    }

    return { ok: true, value: tools };
  }

  selection(state: pi.AgentState | undefined) {
    const extensions = this.selectedExtensions(state);

    const tools = state?.tools;

    const names = [...this.tools.values()]
      .filter(({ extension }) => extensions.includes(extension.name))
      .map(({ tool }) => tool.name);

    return Array.isArray(tools)
      ? [...tools]
      : names.filter((name) => !tools?.remove.includes(name));
  }

  error(state: pi.AgentState | undefined): LabError | undefined {
    const extensions = this.selectedExtensions(state);

    for (const name of extensions) {
      if (!this.extensions.some((extension) => extension.name === name)) {
        return {
          code: "tool_unavailable",
          message: `Extension "${name}" is not configured.`,
        };
      }
    }

    for (const name of this.selection(state)) {
      const definition = this.tools.get(name);

      if (
        definition === undefined ||
        !extensions.includes(definition.extension.name)
      ) {
        return {
          code: "tool_unavailable",
          message: `Tool "${name}" is not available in the configured extensions.`,
        };
      }
    }

    return undefined;
  }

  private selectedExtensions(state: pi.AgentState | undefined) {
    const extensions = state?.extensions;

    return Array.isArray(extensions)
      ? extensions
      : [
          ...this.extensions.map(({ name }) => name),
          ...(extensions?.add ?? []),
        ].filter((name) => !extensions?.remove?.includes(name));
  }
}

function validateExtension(value: unknown) {
  const extension = validate(
    ExtensionSchema,
    value,
    "Expected a Pi extension with valid tool definitions",
  );

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
