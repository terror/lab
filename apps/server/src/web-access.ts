import type { WebAccess, WebRecency } from '@lab/harness';
import { z } from 'zod';

import { credentials } from './credentials';
import { recordUsage } from './helper-usage';

export const searchProviders = [{ id: 'exa', name: 'Exa' }];

const EXA_URL = 'https://api.exa.ai';

const MAX_PAGE_LENGTH = 1_000_000;

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

const costSchema = z.object({
  costDollars: z.object({ total: z.number() }).optional(),
});

async function record(conversationId: number, model: string, cost: number) {
  if (cost > 0) {
    await recordUsage(conversationId, {
      cacheRead: 0,
      cacheWrite: 0,
      cost,
      createdAt: new Date(),
      input: 0,
      kind: 'web',
      model,
      output: 0,
      provider: 'exa',
    });
  }
}

async function exa(conversationId: number, path: string, body: object) {
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

  const json: unknown = await response.json();

  const cost = costSchema.safeParse(json).data?.costDollars?.total ?? 0;

  await record(conversationId, path.slice(1), cost);

  return json;
}

export function webAccess(): WebAccess {
  return {
    available: async () => (await exaKey()) !== undefined,
    fetch: async (conversationId, url) => {
      const { results } = contentsSchema.parse(
        await exa(conversationId, '/contents', {
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
    search: async (conversationId, { domains, limit, query, recency }) => {
      const { results } = searchSchema.parse(
        await exa(conversationId, '/search', {
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
