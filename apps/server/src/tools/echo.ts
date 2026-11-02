import { Type, defineTool } from '@lab/framework';

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
