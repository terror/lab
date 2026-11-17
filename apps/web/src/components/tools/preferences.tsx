import { SlidersHorizontal } from 'lucide-react';

import { field, text } from './format';
import { PreviewList } from './previews';
import type { ToolRenderer } from './types';

const labels: Record<string, (value: unknown) => [string, string]> = {
  chatSort: (value) => ['Sort chats by', text(value) ?? ''],
  lineNumbers: (value) => ['Code line numbers', value ? 'On' : 'Off'],
  theme: (value) => ['Theme', text(value) ?? ''],
};

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
            const label = labels[key];

            if (!label) {
              return [];
            }

            const [name, shown] = label(value);

            return [{ key, label: name, meta: shown }];
          })}
        />
      );
    },
    title: ({ active }) =>
      active ? 'Changing your settings' : 'Changed your settings',
  },
} satisfies Record<string, ToolRenderer>;
