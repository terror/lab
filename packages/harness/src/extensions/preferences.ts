import {
  type ToolExecutionResult,
  defineExtension,
  defineTool,
  section,
} from '@earendil-works/pi-durable';
import { bool, obj, oneOf, opt } from '@earendil-works/pi-schema';

import {
  CHAT_SORTS,
  THEMES,
  type Preferences,
  defaultPreferences,
} from '../preferences';
import { type Owner, userDoc } from './docs';
import { failure, text } from './results';

export const PreferencesDoc = userDoc<Preferences>(
  'lab.user.preferences',
  () => defaultPreferences
);

function describe({
  chatSort,
  lineNumbers,
  theme,
}: Omit<Preferences, 'hints'>) {
  return `theme ${theme}, code block line numbers ${lineNumbers ? 'on' : 'off'}, chats sorted by ${chatSort}`;
}

export function preferences(owner: Owner) {
  const preferencesUpdate = defineTool({
    name: 'preferences_update',
    description:
      "Change the user's Lab settings: the color theme, line numbers in code blocks, and how chats are sorted in the sidebar. Only the fields you pass change.",
    parameters: obj({
      chat_sort: opt(
        oneOf(CHAT_SORTS, {
          description:
            'Sort chats by recent activity, creation date, or title.',
        })
      ),
      line_numbers: opt(
        bool({ description: 'Show line numbers in code blocks.' })
      ),
      theme: opt(oneOf(THEMES, { description: 'The color theme.' })),
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
        return failure('Pass at least one setting to change.');
      }

      const key = await owner(api.conversationId);

      const updated = await api.commit(async (tx) => {
        const doc = await tx.doc(PreferencesDoc, key, null);

        Object.assign(doc, change);

        const { chatSort, lineNumbers, personality, theme } = doc;

        return { chatSort, lineNumbers, personality, theme };
      }, context);

      return {
        details: { change, preferences: updated },
        output: text(
          `Changed ${Object.keys(change).join(', ')}. The user's settings are now: ${describe(updated)}.`
        ),
      };
    },
  });

  return defineExtension({
    name: 'lab.preferences',
    sections: [
      section('preferences', async ({ conversationId, read }, context) => {
        const current =
          (await read.snapshot(
            PreferencesDoc,
            await owner(conversationId),
            context
          )) ?? defaultPreferences;

        return `The user's settings: ${describe(current)}. Change them with preferences_update when the user asks.`;
      }),
    ],
    tools: [preferencesUpdate],
  });
}
