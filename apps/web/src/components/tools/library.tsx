import { formatBytes, plural, shortDate } from '@/lib/format';
import { FileText, Search } from 'lucide-react';

import { count, field, quoted, readRange, text, times } from './format';
import { PreviewList, PreviewPassage } from './previews';
import { type ToolRenderer } from './types';

type LibraryEntry = {
  chat: string | null;
  createdAt: string;
  id: number;
  name: string;
  size: number;
};

export const libraryRenderers = {
  library_read: {
    preview: ({ details }) => {
      const passage = text(field(details, 'passage'));

      return passage ? <PreviewPassage>{passage}</PreviewPassage> : undefined;
    },
    icon: FileText,
    summary: ({ details }) => readRange(details),
    tally: (files) => `read ${plural(files, 'file')}`,
    title: ({ active, details }) => {
      const name = text(field(details, 'name'));

      if (active) {
        return 'Reading a file';
      }

      return name ? `Read ${name}` : 'Read a file';
    },
    yields: 'source',
  },
  library_search: {
    preview: ({ details }) => {
      const entries = field(details, 'entries') as LibraryEntry[] | undefined;

      if (!entries?.length) {
        return undefined;
      }

      return (
        <PreviewList
          items={entries.map(({ createdAt, id, name, size }) => ({
            key: String(id),
            label: name,
            meta: `${formatBytes(size)} · ${shortDate(createdAt)}`,
          }))}
        />
      );
    },
    icon: Search,
    summary: ({ details }) => {
      const found = count(field(details, 'count'));

      return found === undefined ? undefined : plural(found, 'file');
    },
    tally: times('searched your library'),
    title: ({ active, args }) =>
      `${active ? 'Searching' : 'Searched'} your library${quoted(args.query)}`,
  },
} satisfies Record<string, ToolRenderer>;
