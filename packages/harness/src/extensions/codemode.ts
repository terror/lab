import {
  type CodemodeRunOptions,
  CodemodeSandbox,
  type CodemodeSandboxOptions,
} from '@earendil-works/pi-codemode';
import { createCodemodeExtension } from '@earendil-works/pi-durable/codemode';

const MEMORY_LIMIT_BYTES = 256 * 1024 * 1024;

const TIMEOUT_MS = 5 * 60 * 1000;

export class DeadlineSandbox extends CodemodeSandbox {
  readonly #timeoutMs: number;

  constructor(options: CodemodeSandboxOptions & { timeoutMs: number }) {
    super(options);
    this.#timeoutMs = options.timeoutMs;
  }

  override start(code: string, options: CodemodeRunOptions) {
    return super.start(code, {
      ...options,
      timeoutMs: options.timeoutMs ?? this.#timeoutMs,
    });
  }
}

export const codemode = createCodemodeExtension({
  models: false,
  sandbox: new DeadlineSandbox({
    memoryLimitBytes: MEMORY_LIMIT_BYTES,
    timeoutMs: TIMEOUT_MS,
  }),
});
