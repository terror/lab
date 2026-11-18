import type { Preferences } from '@/lib/preferences';
import { SlidersHorizontal } from 'lucide-react';

import { field, text } from './format';
import { PreviewList } from './previews';
import type { ToolRenderer } from './types';

const labels = {
  chatSort: (value) => ['Sort chats by', text(value) ?? ''],
  lineNumbers: (value) => ['Code line numbers', value ? 'On' : 'Off'],
  personality: (value) => ['Personality', text(value) ?? ''],
  theme: (value) => ['Theme', text(value) ?? ''],
} satisfies Record<keyof Preferences, (value: unknown) => [string, string]>;

function isPreference(key: string): key is keyof Preferences {
  return key in labels;
}

export const preferencesRenderers = {
  preferences_update: {
    icon: SlidersHorizontal,
    preview: ({ details }) => {
      const change = field(details, 'change');

      if (typeof change !== 'object' || change === null) {
        return undefined;
      }

      return (
        <PreviewList
          items={Object.entries(change).flatMap(([key, value]) => {
            if (!isPreference(key)) {
              return [];
            }

            const [name, shown] = labels[key](value);

            return [{ key, label: name, meta: shown }];
          })}
        />
      );
    },
    title: ({ active }) =>
      active ? 'Changing your settings' : 'Changed your settings',
  },
} satisfies Record<string, ToolRenderer>;
