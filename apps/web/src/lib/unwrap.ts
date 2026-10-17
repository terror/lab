import type { Result } from "@lab/wire";

export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.value;
}
