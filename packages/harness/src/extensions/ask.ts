import { defineExtension, defineTool } from '@earendil-works/pi-durable';
import { arr, obj, str } from '@earendil-works/pi-schema';

import { waitForAnswer } from './host-input';

const askUser = defineTool({
  name: 'ask_user',
  description:
    "Ask the user a multiple-choice question and wait for their answer. Use it when you need the user's decision to continue and the choices are clear. The user can also type their own answer.",
  callers: ['model'],
  replay: 'safe',
  parameters: obj({
    options: arr(str({ maxLength: 200, minLength: 1 }), {
      description: 'Two to six short answers to choose from.',
      maxItems: 6,
      minItems: 2,
    }),
    question: str({
      description: 'The question to ask.',
      maxLength: 500,
      minLength: 1,
    }),
  }),
  execute: async ({ options, question }, api, context) => {
    await api.details({ options, question }, context);

    const answer = await waitForAnswer(api, context);

    if (answer === undefined) {
      return {
        isError: true,
        output: [{ text: 'Unable to ask the user.', type: 'text' as const }],
      };
    }

    return {
      details: { answer, options, question },
      output: [{ text: `The user answered: ${answer}`, type: 'text' as const }],
    };
  },
});

export const ask = defineExtension({ name: 'lab.ask', tools: [askUser] });
