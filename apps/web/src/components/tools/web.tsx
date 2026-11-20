import { plural } from '@/lib/format';
import { Globe } from 'lucide-react';

import { count, field, quoted, text, times } from './format';
import { PreviewList, PreviewPassage } from './previews';
import { type ToolRenderer } from './types';

type WebResult = { domain: string; title: string; url: string };

export const webRenderers = {
  web_fetch: {
    icon: Globe,
    preview: ({ details }) => {
      const passage = text(field(details, 'passage'));

      return passage ? <PreviewPassage>{passage}</PreviewPassage> : undefined;
    },
    summary: ({ details }) => text(field(details, 'domain')),
    tally: (pages) => `read ${plural(pages, 'page')}`,
    title: ({ active, details }) => {
      const title = text(field(details, 'title'));

      if (active) {
        return 'Reading a page';
      }

      return title ? `Read “${title}”` : 'Read a page';
    },
    yields: 'source',
  },
  web_search: {
    icon: Globe,
    preview: ({ details }) => {
      const results = field(details, 'results') as WebResult[] | undefined;

      if (!results?.length) {
        return undefined;
      }

      return (
        <PreviewList
          items={results.map(({ domain, title, url }) => ({
            href: url,
            key: url,
            label: title,
            meta: domain,
          }))}
        />
      );
    },
    summary: ({ details }) => {
      const found = count(field(details, 'count'));

      return found === undefined ? undefined : plural(found, 'result');
    },
    tally: times('searched'),
    title: ({ active, args }) =>
      `${active ? 'Searching' : 'Searched'} the web${quoted(args.query)}`,
  },
} satisfies Record<string, ToolRenderer>;
