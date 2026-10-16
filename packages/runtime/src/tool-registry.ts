import type * as pi from "@earendil-works/pi-durable";
import type { LabError, Result, ToolCatalog } from "@lab/wire";
import type { Configuration } from "./metadata";

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
