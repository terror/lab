import type { Context } from '@earendil-works/chord/context';
import type { JsonValue } from '@earendil-works/chord/json';
import {
  AgentDoc,
  type HookApi,
  type RegistryReader,
  type ToolHookCall,
  type ToolRegistration,
  ToolTask,
  defineExtension,
  hook,
} from '@earendil-works/pi-durable';
import { type CoercingValidator, compile } from '@earendil-works/pi-schema';
import { formats } from '@earendil-works/pi-schema/formats';

import type { ToolError, ToolErrorKind, ToolIssue } from '../errors';

const kinds: Record<string, ToolErrorKind> = {
  abandoned: 'aborted',
  aborted: 'aborted',
  blocked: 'blocked',
  interrupted: 'interrupted',
  invalid_arguments: 'invalid',
  restart_limit: 'interrupted',
  tool_unavailable: 'unavailable',
};

const validators = new WeakMap<object, CoercingValidator>();

function validator(schema: object) {
  const cached = validators.get(schema);

  if (cached) {
    return cached;
  }

  const compiled = compile(schema, {
    coerce: true,
    formats,
    unresolvedRefs: 'reject',
  });

  validators.set(schema, compiled);

  return compiled;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function segments(pointer: string, value: unknown) {
  const path: (number | string)[] = [];

  let current = value;

  for (const token of pointer.split('/').slice(1)) {
    const key = token.replaceAll('~1', '/').replaceAll('~0', '~');

    if (Array.isArray(current)) {
      path.push(Number(key));
      current = current[Number(key)];
    } else {
      path.push(key);
      current = isObject(current) ? current[key] : undefined;
    }
  }

  return path;
}

async function resolve(
  registry: RegistryReader,
  name: string,
  api: HookApi,
  context: Context
) {
  const candidates = registry
    .snapshot()
    .tools()
    .filter(({ tool }) => tool.name === name);

  if (candidates.length < 2) {
    return candidates[0]?.tool;
  }

  const agent = await api.snapshot(AgentDoc, api.conversationId, context);

  const selected = Array.isArray(agent?.extensions)
    ? agent.extensions
    : (agent?.extensions?.add ?? []);

  return candidates.find(({ extension }) => selected.includes(extension.name))
    ?.tool;
}

function repaired(tool: ToolRegistration, args: unknown) {
  try {
    return tool.prepareArguments ? tool.prepareArguments(args) : args;
  } catch {
    return undefined;
  }
}

async function issues(
  registry: RegistryReader,
  call: ToolHookCall,
  api: HookApi,
  context: Context
): Promise<ToolIssue[]> {
  if (call.argumentsError !== undefined) {
    return [];
  }

  const tool = await resolve(registry, call.name, api, context);

  const args = tool && repaired(tool, call.arguments);

  if (!tool || args === undefined) {
    return [];
  }

  const check = validator(tool.parameters);

  const coerced = check.coerce(structuredClone(args));

  return check.errors(coerced).map(({ keyword, message, path }) => ({
    keyword,
    message,
    path: segments(path, coerced),
  }));
}

function withError(details: JsonValue | undefined, error: ToolError) {
  if (details === undefined) {
    return { error };
  }

  return isObject(details) ? { ...details, error } : details;
}

export function toolErrors(registry: RegistryReader) {
  return defineExtension({
    hooks: [
      hook(ToolTask, {
        afterTool: async (call, result, api, context) => {
          const diagnostic = result.isError
            ? result.diagnostics?.findLast(
                ({ severity }) => severity === 'error'
              )
            : undefined;

          if (!diagnostic) {
            return undefined;
          }

          const kind = kinds[diagnostic.code ?? ''] ?? 'failed';

          const error = {
            issues:
              kind === 'invalid'
                ? await issues(registry, call, api, context)
                : [],
            kind,
            message: diagnostic.message,
          };

          return { ...result, details: withError(result.details, error) };
        },
      }),
    ],
    name: 'lab.errors',
  });
}
