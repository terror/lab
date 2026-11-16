import { CodemodeSandbox } from '@earendil-works/pi-codemode';
import { createCodemodeExtension } from '@earendil-works/pi-durable/codemode';

export const codemode = createCodemodeExtension({
  sandbox: new CodemodeSandbox(),
});
