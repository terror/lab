import { Type } from '@earendil-works/pi-ai';
import { defineTool } from '@earendil-works/pi-durable';

export const echo = defineTool({
  name: 'echo',
  description: 'Return the supplied text unchanged.',
  parameters: Type.Object({ text: Type.String() }),
  replay: 'safe',
  execute: async ({ text }, api) => {
    api.output(text);
    return {};
  },
});
