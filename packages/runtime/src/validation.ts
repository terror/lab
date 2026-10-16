import { type Static, type TSchema, Type } from "typebox";
import { Check } from "typebox/value";

export function validate<S extends TSchema>(
  schema: S,
  value: unknown,
  message: string,
): Static<S> {
  if (!Check(schema, value)) {
    throw new Error(message);
  }

  return value;
}

export function functionSchema<T extends (...args: never[]) => unknown>() {
  return Type.Unsafe<T>(Type.Function([], Type.Unknown()));
}
