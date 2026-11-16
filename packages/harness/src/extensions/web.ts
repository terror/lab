import { defineExtension, defineTool } from '@earendil-works/pi-durable';
import { obj, str } from '@earendil-works/pi-schema';
import { z } from 'zod';

const MAX_PAGE_LENGTH = 20_000;

const MAX_REDIRECTS = 5;

const searchResponseSchema = z.object({
  web: z
    .object({
      results: z.array(
        z.object({
          description: z.string().optional(),
          title: z.string(),
          url: z.string(),
        })
      ),
    })
    .optional(),
});

const entities = new Map([
  ['amp', '&'],
  ['apos', "'"],
  ['gt', '>'],
  ['lt', '<'],
  ['nbsp', ' '],
  ['quot', '"'],
]);

function decodeEntities(text: string) {
  return text.replaceAll(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      if (entity.startsWith('#x') || entity.startsWith('#X')) {
        return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      }

      if (entity.startsWith('#')) {
        return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
      }

      return entities.get(entity.toLowerCase()) ?? match;
    }
  );
}

function stripTags(text: string) {
  return decodeEntities(text.replaceAll(/<[^>]+>/g, ''));
}

function isPrivateHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd')) {
    return true;
  }

  if (host.startsWith('fe80:')) {
    return true;
  }

  const octets = host.split('.').map(Number);

  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet))) {
    return false;
  }

  const [a = 0, b = 0] = octets;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function assertPublic(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Only http and https URLs can be fetched: ${url.href}`);
  }

  if (isPrivateHost(url.hostname)) {
    throw new Error(`Private addresses cannot be fetched: ${url.href}`);
  }
}

async function fetchPublic(url: URL, redirects = 0): Promise<Response> {
  assertPublic(url);

  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,text/plain;q=0.9,*/*;q=0.1',
      'User-Agent': 'Mozilla/5.0 (compatible; Lab/1.0)',
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  });

  const location = response.headers.get('location');

  if (response.status >= 300 && response.status < 400 && location) {
    if (redirects >= MAX_REDIRECTS) {
      throw new Error(`Too many redirects fetching ${url.href}`);
    }

    return fetchPublic(new URL(location, url), redirects + 1);
  }

  return response;
}

async function readableText(response: Response) {
  const parts: string[] = [];
  const title: string[] = [];

  let hidden = 0;
  let inTitle = false;

  await new HTMLRewriter()
    .on('script, style, noscript, svg, template, iframe', {
      element(element) {
        hidden += 1;
        element.onEndTag(() => {
          hidden -= 1;
        });
      },
    })
    .on('title', {
      element(element) {
        inTitle = true;
        element.onEndTag(() => {
          inTitle = false;
        });
      },
    })
    .on('p, div, br, li, tr, h1, h2, h3, h4, h5, h6, section, article', {
      element() {
        parts.push('\n');
      },
    })
    .onDocument({
      text(chunk) {
        if (inTitle) {
          title.push(chunk.text);
        } else if (hidden === 0) {
          parts.push(chunk.text);
        }
      },
    })
    .transform(response)
    .text();

  const text = decodeEntities(parts.join(''))
    .replaceAll(/[ \t\f\v]+/g, ' ')
    .replaceAll(/\s*\n\s*/g, '\n')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();

  return { text, title: decodeEntities(title.join('')).trim() };
}

function truncate(text: string) {
  if (text.length <= MAX_PAGE_LENGTH) {
    return text;
  }

  return `${text.slice(0, MAX_PAGE_LENGTH)}\n\n[Truncated]`;
}

const fetchPage = defineTool({
  name: 'fetch_page',
  description:
    'Fetch a public web page by URL and return its readable text. Use it to read search results or links the user shares.',
  parameters: obj({ url: str() }),
  replay: 'safe',
  execute: async ({ url }, api, context) => {
    const response = await fetchPublic(new URL(url));

    if (!response.ok) {
      throw new Error(`Fetching ${url} failed: ${response.status}`);
    }

    const type = response.headers.get('content-type') ?? '';

    const page = type.includes('html')
      ? await readableText(response)
      : { text: await response.text(), title: '' };

    await api.details({ title: page.title, url: response.url || url }, context);

    return { output: [{ type: 'text', text: truncate(page.text) }] };
  },
});

function createSearchTool(apiKey: string) {
  return defineTool({
    name: 'web_search',
    description:
      'Search the web for current information. Returns titles, URLs, and snippets of the top results; use fetch_page to read one.',
    parameters: obj({ query: str() }),
    replay: 'safe',
    execute: async ({ query }, api, context) => {
      const url = new URL('https://api.search.brave.com/res/v1/web/search');

      url.searchParams.set('q', query);
      url.searchParams.set('count', '8');

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': apiKey,
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const results =
        searchResponseSchema.parse(await response.json()).web?.results ?? [];

      await api.details(
        {
          results: results.map(({ title, url: link }) => ({
            title,
            url: link,
          })),
        },
        context
      );

      const text = results
        .map(
          ({ description, title, url: link }, index) =>
            `${index + 1}. ${stripTags(title)}\n${link}\n${stripTags(description ?? '')}`
        )
        .join('\n\n');

      return { output: [{ type: 'text', text: text || 'No results.' }] };
    },
  });
}

export function createWebExtension(searchApiKey: string | undefined) {
  return defineExtension({
    name: 'lab.web',
    tools: searchApiKey
      ? [createSearchTool(searchApiKey), fetchPage]
      : [fetchPage],
  });
}
