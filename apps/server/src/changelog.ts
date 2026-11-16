import { Hono } from 'hono';
import { z } from 'zod';

import { env } from './env';
import { validator } from './validator';

const version = env.RAILWAY_GIT_COMMIT_SHA;

const compareSchema = z.object({
  commits: z.array(
    z.object({
      commit: z.object({
        author: z.object({ date: z.string() }).nullable(),
        message: z.string(),
      }),
      html_url: z.string(),
      sha: z.string(),
    })
  ),
});

type Entry = { date: string | null; sha: string; title: string; url: string };

const cache = new Map<string, Entry[]>();

function entry({
  commit,
  html_url,
  sha,
}: z.infer<typeof compareSchema>['commits'][number]): Entry {
  const [subject = ''] = commit.message.split('\n');

  const date = commit.author?.date ?? null;

  const pull = /\s*\(#(\d+)\)$/.exec(subject);

  if (!pull) {
    return { date, sha, title: subject, url: html_url };
  }

  return {
    date,
    sha,
    title: subject.slice(0, pull.index),
    url: `https://github.com/${env.LAB_REPOSITORY}/pull/${pull[1]}`,
  };
}

async function changes(since: string) {
  const cached = cache.get(since);

  if (cached) {
    return cached;
  }

  const response = await fetch(
    `https://api.github.com/repos/${env.LAB_REPOSITORY}/compare/${since}...${version}`,
    { headers: { accept: 'application/vnd.github+json' } }
  );

  if (!response.ok) {
    return [];
  }

  const parsed = compareSchema.safeParse(await response.json());

  const entries = (parsed.data?.commits ?? []).map(entry).toReversed();

  cache.set(since, entries);

  return entries;
}

const query = validator(
  'query',
  z.object({ since: z.string().regex(/^[0-9a-f]{7,40}$/) })
);

const changelog = new Hono()
  .get('/version', (c) => c.json({ version }))
  .get('/changelog', query, async (c) => {
    const { since } = c.req.valid('query');

    const entries = since === version ? [] : await changes(since);

    return c.json({ entries, version });
  });

export default changelog;
