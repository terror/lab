export class Store<T> {
  private readonly listeners = new Set<() => void>();

  constructor(private value: T) {}

  readonly getSnapshot = () => this.value;

  readonly subscribe = (listener: () => void) => {
    const notify = () => listener();
    this.listeners.add(notify);

    return () => {
      this.listeners.delete(notify);
    };
  };

  set(value: T) {
    if (Object.is(this.value, value)) {
      return;
    }

    this.value = value;

    for (const listener of this.listeners) {
      listener();
    }
  }
}

export function clientError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
