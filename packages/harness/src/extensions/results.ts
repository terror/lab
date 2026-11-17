import type { Context } from '@earendil-works/chord/context';
import type { JsonValue } from '@earendil-works/chord/json';
import type {
  ToolExecutionApi,
  ToolExecutionResult,
} from '@earendil-works/pi-durable';

export function text(value: string) {
  return [{ text: value, type: 'text' as const }];
}

export function failure(message: string): ToolExecutionResult {
  return { isError: true, output: text(message) };
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function once<T extends JsonValue>(
  api: ToolExecutionApi,
  name: string,
  context: Context,
  run: () => Promise<T>
) {
  return (
    (await api.memo<T>(name, context)) ??
    (await api.memo(name, await run(), context))
  );
}
