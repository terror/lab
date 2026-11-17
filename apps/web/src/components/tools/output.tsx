import { ScrollText } from 'lucide-react';

import { readRange, text } from './format';
import { PreviewPassage } from './previews';
import type { ToolRenderer } from './types';

export const outputRenderers = {
  tool_output_read: {
    icon: ScrollText,
    preview: ({ output }) => {
      const passage = text(output)?.slice(0, 600);

      return passage ? <PreviewPassage>{passage}</PreviewPassage> : undefined;
    },
    summary: ({ details }) => readRange(details),
    title: ({ active }) =>
      active ? 'Reading more of a result' : 'Read more of a result',
  },
} satisfies Record<string, ToolRenderer>;
