import { HTTPException } from 'hono/http-exception';

export function found<T>(value: T | false | null | undefined, message: string) {
  if (!value) {
    throw new HTTPException(404, { message });
  }

  return value;
}
