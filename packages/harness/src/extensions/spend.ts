import { ToolTask, defineExtension, hook } from '@earendil-works/pi-durable';

import type { Admit } from './delegate';

export function spend(admit: Admit) {
  return defineExtension({
    hooks: [
      hook(ToolTask, {
        afterTool: async (call, result, api) => {
          if (call.parent) {
            return undefined;
          }

          const admitted = await admit(api.conversationId).then(
            () => true,
            () => false
          );

          if (admitted) {
            return undefined;
          }

          return { ...result, control: { ...result.control, terminate: true } };
        },
      }),
    ],
    name: 'lab.spend',
  });
}
