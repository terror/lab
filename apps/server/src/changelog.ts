import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireUser } from './auth';
import { env } from './env';
import { validator } from './validator';

const version = env.RAILWAY_GIT_COMMIT_SHA;

const commitsSchema = z.array(
  z.object({
    commit: z.object({
      author: z.object({ date: z.string() }).nullable(),
      message: z.string(),
    }),
    html_url: z.string(),
    sha: z.string(),
  })
);

const pullsSchema = z.array(
  z.object({
    body: z.string().nullable(),
    labels: z.array(z.object({ name: z.string() })),
    number: z.number(),
  })
);

const LABEL = 'user-facing';

type Commit = z.infer<typeof commitsSchema>[number];

type Entry = {
  date: string | null;
  description: string | null;
  sha: string;
  title: string;
  url: string;
};

type History = {
  bodies: ReadonlyMap<number, string>;
  commits: Commit[];
};

let history: Promise<History> | undefined;

function paragraph(text: string) {
  return (
    text
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .find(
        (block) =>
          block.length > 0 &&
          !/^https?:\/\/\S+$/.test(block) &&
          !block.startsWith('<') &&
          !block.startsWith('* ')
      ) ?? null
  );
}

function entry(
  { commit, sha }: Commit,
  bodies: ReadonlyMap<number, string>
): Entry[] {
  const [subject = ''] = commit.message.split('\n');

  const pull = /\s*\(#(\d+)\)$/.exec(subject);

  const body = pull && bodies.get(Number(pull[1]));

  if (!pull || body === undefined || body === null) {
    return [];
  }

  return [
    {
      date: commit.author?.date ?? null,
      description: paragraph(body),
      sha,
      title: subject.slice(0, pull.index),
      url: `https://github.com/${env.LAB_REPOSITORY}/pull/${pull[1]}`,
    },
  ];
}

async function github(path: string) {
  const response = await fetch(
    `https://api.github.com/repos/${env.LAB_REPOSITORY}/${path}`,
    { headers: { accept: 'application/vnd.github+json' } }
  );

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new HTTPException(502, { message: 'Unable to load the changelog' });
  }

  return response.json();
}

async function load(): Promise<History> {
  const [commits, pulls] = await Promise.all([
    github(`commits?sha=${version}&per_page=100`),
    github('pulls?state=closed&sort=updated&direction=desc&per_page=100'),
  ]);

  return {
    bodies: new Map(
      (pullsSchema.safeParse(pulls).data ?? [])
        .filter(({ labels }) => labels.some(({ name }) => name === LABEL))
        .map(({ body, number }) => [number, body ?? ''] as const)
    ),
    commits: commitsSchema.safeParse(commits).data ?? [],
  };
}

async function changes(since: string) {
  history ??= load().catch((error: unknown) => {
    history = undefined;
    throw error;
  });

  const { bodies, commits } = await history;

  const seen = commits.findIndex(({ sha }) => sha.startsWith(since));

  return commits
    .slice(0, seen === -1 ? undefined : seen)
    .flatMap((commit) => entry(commit, bodies));
}

const query = validator(
  'query',
  z.object({ since: z.string().regex(/^[0-9a-f]{7,40}$/) })
);

const changelog = new Hono()
  .get('/version', (c) => c.json({ version }))
  .get('/changelog', requireUser, query, async (c) => {
    const { since } = c.req.valid('query');

    const entries = since === version ? [] : await changes(since);

    return c.json({ entries, version });
  });

export default changelog;
