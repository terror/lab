type OmitUndefined<T> = T extends object
  ? {
      [K in keyof T as undefined extends T[K] ? never : K]: T[K];
    } & {
      [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<
        T[K],
        undefined
      >;
    }
  : never;

export function omitUndefined<T extends object>(value: T): OmitUndefined<T> {
  const result = { ...value };

  for (const key of Reflect.ownKeys(result)) {
    if (Reflect.get(result, key) === undefined) {
      Reflect.deleteProperty(result, key);
    }
  }

  return result as unknown as OmitUndefined<T>;
}
