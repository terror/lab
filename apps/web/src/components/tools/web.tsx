import { Globe } from 'lucide-react';

import { count, field, plural, quoted, text } from './format';
import { PreviewList, PreviewPassage } from './previews';
import { type ToolRenderer } from './types';

type WebResult = { domain: string; title: string; url: string };

export const webRenderers: Record<string, ToolRenderer> = {
  web_fetch: {
    icon: Globe,
    preview: ({ details }) => {
      const passage = text(field(details, 'passage'));

      return passage ? <PreviewPassage>{passage}</PreviewPassage> : undefined;
    },
    summary: ({ details }) => text(field(details, 'domain')),
    title: ({ active, details }) => {
      const title = text(field(details, 'title'));

      if (active) {
        return 'Reading a page';
      }

      return title ? `Read “${title}”` : 'Read a page';
    },
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
    title: ({ active, args }) =>
      `${active ? 'Searching' : 'Searched'} the web${quoted(args.query)}`,
  },
};
