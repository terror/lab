import {
  type CodemodeRunOptions,
  CodemodeSandbox,
  type CodemodeSandboxOptions,
} from '@earendil-works/pi-codemode';
import { createCodemodeExtension } from '@earendil-works/pi-durable/codemode';

const MAX_TIMEOUT_MS = 15 * 60 * 1000;

const MEMORY_LIMIT_BYTES = 128 * 1024 * 1024;

const SCRIPTS = 4;

const TIMEOUT_MS = 5 * 60 * 1000;

export function workerSlots(limit: number) {
  let running = 0;

  return () => {
    if (running >= limit) {
      throw new Error('Too many scripts are running. Try again once one ends.');
    }

    running += 1;

    return () => {
      running -= 1;
    };
  };
}

export class DeadlineSandbox extends CodemodeSandbox {
  readonly #maxTimeoutMs: number;
  readonly #timeoutMs: number;

  constructor(
    options: CodemodeSandboxOptions & {
      maxTimeoutMs: number;
      timeoutMs: number;
    }
  ) {
    super(options);
    this.#maxTimeoutMs = options.maxTimeoutMs;
    this.#timeoutMs = options.timeoutMs;
  }

  override start(code: string, options: CodemodeRunOptions) {
    return super.start(code, {
      ...options,
      timeoutMs: Math.min(
        options.timeoutMs ?? this.#timeoutMs,
        this.#maxTimeoutMs
      ),
    });
  }
}

export const codemode = createCodemodeExtension({
  models: false,
  sandbox: new DeadlineSandbox({
    acquireWorker: workerSlots(SCRIPTS),
    maxTimeoutMs: MAX_TIMEOUT_MS,
    memoryLimitBytes: MEMORY_LIMIT_BYTES,
    timeoutMs: TIMEOUT_MS,
  }),
});
