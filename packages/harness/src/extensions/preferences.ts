import {
  type ToolExecutionResult,
  defineDoc,
  defineExtension,
  defineTool,
  section,
} from '@earendil-works/pi-durable';
import { bool, lit, obj, opt, union } from '@earendil-works/pi-schema';

import {
  CHAT_SORTS,
  THEMES,
  type Preferences,
  defaultPreferences,
} from '../preferences';

export const PreferencesDoc = defineDoc<Preferences>({
  kind: 'lab.preferences',
  version: 1,
  scope: 'session',
  initial: () => defaultPreferences,
  checkpointWhen: () => true,
});

function choice<T extends string>(values: readonly T[], description: string) {
  return union(
    values.map((value) => lit(value)),
    { description }
  );
}

function describe({ chatSort, lineNumbers, theme }: Preferences) {
  return `theme ${theme}, code block line numbers ${lineNumbers ? 'on' : 'off'}, chats sorted by ${chatSort}`;
}

const preferencesUpdate = defineTool({
  name: 'preferences_update',
  description:
    "Change the user's Lab settings: the color theme, line numbers in code blocks, and how chats are sorted in the sidebar. Only the fields you pass change.",
  parameters: obj({
    chat_sort: opt(
      choice(
        CHAT_SORTS,
        'Sort chats by recent activity, creation date, or title.'
      )
    ),
    line_numbers: opt(
      bool({ description: 'Show line numbers in code blocks.' })
    ),
    theme: opt(choice(THEMES, 'The color theme.')),
  }),
  execute: async (args, api, context): Promise<ToolExecutionResult> => {
    const change: Partial<Preferences> = {
      ...(args.chat_sort && { chatSort: args.chat_sort }),
      ...(args.line_numbers !== undefined && {
        lineNumbers: args.line_numbers,
      }),
      ...(args.theme && { theme: args.theme }),
    };

    if (Object.keys(change).length === 0) {
      return {
        isError: true,
        output: [
          {
            text: 'Pass at least one setting to change.',
            type: 'text' as const,
          },
        ],
      };
    }

    const preferences = await api.commit(async (tx) => {
      const doc = await tx.doc(PreferencesDoc);

      Object.assign(doc, change);

      return { ...doc };
    }, context);

    return {
      details: { change, preferences },
      output: [
        {
          text: `Changed ${Object.keys(change).join(', ')}. The user's settings are now: ${describe(preferences)}.`,
          type: 'text' as const,
        },
      ],
    };
  },
});

export const preferences = defineExtension({
  name: 'lab.preferences',
  sections: [
    section('preferences', async ({ read }, context) => {
      const current =
        (await read.snapshot(PreferencesDoc, context)) ?? defaultPreferences;

      return `The user's settings: ${describe(current)}. Change them with preferences_update when the user asks.`;
    }),
  ],
  tools: [preferencesUpdate],
});
