import type { EntryRecord } from '@earendil-works/pi-durable';
import { type WebAccess, type WebRecency, normalizeUrl } from '@lab/harness';
import { z } from 'zod';

import { credentials } from './credentials';
import { messageData } from './message-entry';

export const searchProviders = [{ id: 'exa', name: 'Exa' }];

const EXA_URL = 'https://api.exa.ai';

const MAX_PAGE_LENGTH = 200_000;

const DAY = 86_400_000;

const recencyDays: Record<WebRecency, number> = {
  day: 1,
  month: 31,
  week: 7,
  year: 366,
};

const searchSchema = z.object({
  results: z.array(
    z.object({
      highlights: z.array(z.string()).optional(),
      publishedDate: z.string().nullish(),
      title: z.string().nullish(),
      url: z.string(),
    })
  ),
});

const contentsSchema = z.object({
  results: z.array(
    z.object({
      text: z.string().nullish(),
      title: z.string().nullish(),
      url: z.string(),
    })
  ),
});

const NOT_CONFIGURED =
  "Web search isn't set up. The user can add an Exa key in Settings → Providers.";

async function exaKey() {
  const credential = await credentials.read('exa');

  return credential?.type === 'api_key' ? credential.key : undefined;
}

async function exa(path: string, body: object) {
  const key = await exaKey();

  if (!key) {
    throw new Error(NOT_CONFIGURED);
  }

  const response = await fetch(`${EXA_URL}${path}`, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-api-key': key },
    method: 'POST',
    signal: AbortSignal.timeout(20_000),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      'Exa rejected the API key. The user can update it in Settings → Providers.'
    );
  }

  if (!response.ok) {
    throw new Error(`Web search failed (${response.status}).`);
  }

  return response.json();
}

const URL_PATTERN = /https?:\/\/[^\s<>()"'`]+/g;

function linksIn(text: string) {
  return [...text.matchAll(URL_PATTERN)].flatMap(
    ([match]) => normalizeUrl(match.replace(/[.,;:!?]+$/, '')) ?? []
  );
}

type Entries = (conversationId: number) => Promise<readonly EntryRecord[]>;

export function webAccess(entries: Entries): WebAccess {
  return {
    available: async () => (await exaKey()) !== undefined,
    fetch: async (url) => {
      const { results } = contentsSchema.parse(
        await exa('/contents', {
          text: { maxCharacters: MAX_PAGE_LENGTH },
          urls: [url],
        })
      );

      const [page] = results;

      if (!page?.text) {
        throw new Error(`Unable to read ${url}.`);
      }

      return { text: page.text, title: page.title ?? url, url: page.url };
    },
    mentioned: async (conversationId, url) => {
      const messages = await entries(conversationId);

      return messages.some((entry) =>
        linksIn(messageData(entry)?.text ?? '').includes(url)
      );
    },
    search: async ({ domains, limit, query, recency }) => {
      const { results } = searchSchema.parse(
        await exa('/search', {
          contents: { highlights: { highlightsPerUrl: 1, numSentences: 3 } },
          numResults: limit,
          query,
          type: 'auto',
          ...(domains?.length && { includeDomains: domains }),
          ...(recency && {
            startPublishedDate: new Date(
              Date.now() - recencyDays[recency] * DAY
            ).toISOString(),
          }),
        })
      );

      return results.map(({ highlights, publishedDate, title, url }) => ({
        published: publishedDate ?? null,
        snippet: highlights?.join(' ') ?? '',
        title: title ?? url,
        url,
      }));
    },
  };
}
