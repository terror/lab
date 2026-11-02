import { defineTool } from '@lab/harness-pi';
import { Type } from '@lab/protocol';

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
