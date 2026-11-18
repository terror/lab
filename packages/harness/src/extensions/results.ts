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

export function page(
  content: string,
  offset: number,
  length: number,
  { ending, next }: { ending?: string; next: (offset: number) => string }
) {
  const start = Math.min(offset, content.length);

  const end = Math.min(content.length, start + length);

  const passage = content.slice(start, end);

  const note =
    end < content.length
      ? `[Showing characters ${start}–${end} of ${content.length}. ${next(end)}]`
      : ending && `[End of ${ending} at character ${content.length}.]`;

  return {
    end,
    passage,
    start,
    text: note ? `${passage}\n\n${note}` : passage,
    total: content.length,
  };
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
