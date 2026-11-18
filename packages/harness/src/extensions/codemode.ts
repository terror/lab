import { CodemodeSandbox } from '@earendil-works/pi-codemode';
import { createCodemodeExtension } from '@earendil-works/pi-durable/codemode';

const MEMORY_LIMIT_BYTES = 256 * 1024 * 1024;

export const codemode = createCodemodeExtension({
  models: false,
  sandbox: new CodemodeSandbox({ memoryLimitBytes: MEMORY_LIMIT_BYTES }),
});
