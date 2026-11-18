import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { schema } from '@lab/db';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { signIn, signInAdmin } from '../test/auth';
import { call, chat, settle } from '../test/client';
import { serveProtectedMcp } from '../test/mcp';
import { script, toolCall } from '../test/models';
import app from './app';
import { db } from './db';

type Shape = {
  anyOf?: Shape[];
  const?: unknown;
  enum?: unknown[];
  oneOf?: Shape[];
  properties?: Record<string, Shape>;
  required?: string[];
  type?: string;
};

type Operation = {
  parameters?: { in: string; name: string; required?: boolean }[];
  requestBody?: { content: Record<string, { schema: Shape }> };
};

type Spec = { paths: Record<string, Record<string, Operation>> };

type Values = Record<string, number | string>;

type Fixtures = { params: Record<string, Values[]>; references: Values };

type Case = { body?: unknown; foreign: boolean; method: string; path: string };

const secret = randomUUID();

const open = new Set([
  'GET /api/connectors/client-metadata.json',
  'GET /api/health',
  'GET /api/version',
]);

const routes = [
  ...new Set(
    app.routes
      .filter(
        ({ method, path }) =>
          method !== 'ALL' &&
          path.startsWith('/api/') &&
          !path.startsWith('/api/auth/')
      )
      .map(({ method, path }) => `${method} ${path}`)
  ),
];

const scalars: Record<string, unknown> = {
  array: [],
  boolean: true,
  integer: 1,
  number: 1,
  string: 'foo',
};

function sample(shape: Shape, references: Values): unknown {
  const [variant] = shape.oneOf ?? shape.anyOf ?? [];

  if (shape.const !== undefined) {
    return shape.const;
  }

  if (shape.enum) {
    return shape.enum[0];
  }

  if (variant) {
    return sample(variant, references);
  }

  if (shape.type !== 'object') {
    return scalars[shape.type ?? ''];
  }

  const properties = Object.entries(shape.properties ?? {});

  const required = new Set(shape.required ?? properties.map(([name]) => name));

  return Object.fromEntries(
    properties.flatMap(([name, property]) => {
      if (name in references) {
        return [[name, references[name]]];
      }

      return required.has(name) ? [[name, sample(property, references)]] : [];
    })
  );
}

function referenced(body: unknown, references: Values) {
  return typeof body === 'object' && body !== null
    ? Object.keys(references).filter((name) => name in body)
    : [];
}

function expand(
  spec: Spec,
  route: string,
  owner: Fixtures,
  intruder: Fixtures
) {
  const [method = '', path = ''] = route.split(' ');

  const operation =
    spec.paths[path.replace(/:(\w+)/g, '{$1}')]?.[method.toLowerCase()];

  const names = [...path.matchAll(/:(\w+)/g)].map(([, name = '']) => name);

  const queries = (operation?.parameters ?? []).flatMap(
    ({ in: location, name, required }) =>
      location === 'query' && required ? [name] : []
  );

  const shape = operation?.requestBody?.content['application/json']?.schema;

  const resource = path.split('/')[2] ?? '';

  const sets = owner.params[resource] ?? [{}];

  if (names.some((name) => sets.some((values) => !(name in values)))) {
    return { cases: [], missing: [route] };
  }

  const request = (values: Values, references: Values) => {
    const filled = path.replace(/:(\w+)/g, (_, name: string) =>
      String(values[name])
    );

    const query = new URLSearchParams(
      Object.fromEntries(
        queries.map((name) => [name, String(values[name] ?? secret)])
      )
    );

    return {
      body: shape && sample(shape, references),
      method,
      path: query.size > 0 ? `${filled}?${query.toString()}` : filled,
    };
  };

  const direct = (names.length > 0 ? sets : sets.slice(0, 1)).map((values) => {
    const made = request(values, owner.references);

    return {
      ...made,
      foreign:
        names.length > 0 ||
        queries.some((name) => name in values) ||
        referenced(made.body, owner.references).length > 0,
    };
  });

  const own = intruder.params[resource]?.[0];

  const crossed =
    names.length > 0 && own
      ? referenced(direct[0]?.body, owner.references).map((name) => ({
          ...request(own, {
            ...intruder.references,
            [name]: owner.references[name] ?? '',
          }),
          foreign: true,
        }))
      : [];

  return { cases: [...direct, ...crossed], missing: [] };
}

async function send(headers: Headers, { body, method, path }: Case) {
  const response = await app.request(
    path,
    {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        ...Object.fromEntries(headers),
        'content-type': 'application/json',
      },
      method,
    },
    { timeout: () => undefined }
  );

  if (response.headers.get('content-type')?.startsWith('text/event-stream')) {
    await response.body?.cancel();

    return { status: response.status, text: '' };
  }

  return { status: response.status, text: await response.text() };
}

function defined<T>(value: T | undefined) {
  if (value === undefined) {
    throw new Error('Missing fixture');
  }

  return value;
}

function named<T extends { name?: string; text?: string }>(items: T[]) {
  return defined(items.find(({ name, text }) => (name ?? text) === secret));
}

async function seed(headers: Headers): Promise<Fixtures> {
  const form = new FormData();

  form.set(
    'document',
    new File([secret], 'foo.pdf', { type: 'application/pdf' })
  );
  form.set('thumbnail', new File(['bar'], 'bar.png', { type: 'image/png' }));

  const uploaded = await app.request('/api/uploads', {
    body: form,
    headers,
    method: 'POST',
  });

  const { id: upload } = (await uploaded.json()) as { id: string };

  script(
    toolCall('artifact_create', {
      content: '<p>foo</p>',
      id: 'bar',
      title: secret,
    }),
    fauxAssistantMessage('baz')
  );

  const id = await chat(headers, {
    attachments: [
      { data: 'Zm9v', mimeType: 'image/png', name: secret, type: 'image' },
      { name: secret, text: secret, type: 'file', uploadId: upload },
    ],
    content: secret,
    model: { id: 'anthropic/claude-haiku-5.5', provider: 'vercel-ai-gateway' },
  });

  const conversation = `/conversations/${id}`;

  const { body: submission } = await call(
    headers,
    'POST',
    `${conversation}/messages`,
    { content: secret }
  );

  await settle(id);

  const { body: entries } = await call(
    headers,
    'GET',
    `${conversation}/entries?order=ascending`
  );

  const { id: entryId } = defined(
    (entries.items as { id: number; model?: { role: string }[] }[]).find(
      ({ model }) => model?.[0]?.role === 'user'
    )
  );

  await call(headers, 'PATCH', conversation, { pinned: true, title: secret });

  await call(headers, 'PUT', `${conversation}/artifacts/bar/pin`, {
    projectId: null,
  });

  await call(headers, 'PUT', `${conversation}/artifacts/bar/state?key=foo`, {
    value: JSON.stringify(secret),
  });

  const [project, trashedProject] = (await Promise.all(
    [0, 1].map(async () => {
      const { body } = await call(headers, 'POST', '/projects', {
        name: secret,
      });

      return body.project.id;
    })
  )) as [number, number];

  await call(headers, 'DELETE', `/projects/${trashedProject}`);

  const trashedChat = await chat(headers, { content: secret });

  await call(headers, 'PATCH', `/conversations/${trashedChat}`, {
    title: secret,
  });

  await call(headers, 'DELETE', `/conversations/${trashedChat}`);

  const [memory, skills, library] = await Promise.all([
    call(headers, 'POST', '/memory', { text: secret }),
    call(headers, 'POST', '/skills', {
      description: secret,
      instructions: secret,
      name: secret,
    }),
    call(headers, 'GET', '/library'),
  ]);

  const [chatRow] = await db
    .select({ ownerId: schema.conversation.ownerId })
    .from(schema.conversation)
    .where(eq(schema.conversation.id, id));

  const [{ id: schedule }] = (await db
    .insert(schema.scheduledTask)
    .values({
      conversationId: id,
      cron: '0 9 * * *',
      description: secret,
      ownerId: defined(chatRow).ownerId,
      prompt: secret,
      timezone: 'UTC',
      title: secret,
    })
    .returning({ id: schema.scheduledTask.id })) as [{ id: number }];

  return {
    params: {
      conversations: [
        {
          artifactId: 'bar',
          entryId,
          id,
          index: 0,
          key: 'foo',
          submissionId: submission.id,
        },
      ],
      library: [
        {
          id: named<{ id: number; name: string; upload: unknown }>(
            library.body.items.filter(
              (item: { upload: unknown }) => item.upload
            )
          ).id,
        },
      ],
      memory: [
        { id: named<{ id: string; text: string }>(memory.body.memories).id },
      ],
      projects: [{ id: project }],
      providers: [{ id: 'exa' }],
      schedules: [{ id: schedule }],
      skills: [
        { id: named<{ id: string; name: string }>(skills.body.skills).id },
      ],
      trash: [
        { id: trashedChat, kind: 'conversation' },
        { id: trashedProject, kind: 'project' },
      ],
      uploads: [{ id: upload }],
    },
    references: { entryId, projectId: project },
  };
}

async function sweep(
  headers: Headers | (() => Promise<Headers>),
  cases: Case[]
) {
  const results = [];

  for (const made of cases) {
    const { status, text } = await send(
      typeof headers === 'function' ? await headers() : headers,
      made
    );

    results.push({ ...made, status, text });
  }

  return results;
}

type Result = Case & { status: number; text: string };

function failures(results: Result[], failed: (result: Result) => boolean) {
  return results.flatMap((result) =>
    failed(result) ? [`${result.method} ${result.path} ${result.status}`] : []
  );
}

test('no route reaches another user’s records', async () => {
  const mcp = serveProtectedMcp();

  const ownerHeaders = await signInAdmin();

  const owner = await seed(ownerHeaders);

  const { body: connectors } = await call(ownerHeaders, 'POST', '/connectors', {
    name: secret,
    url: mcp.url,
  });

  const { id: connector } = named<{ id: number; name: string }>(
    connectors.connectors
  );

  owner.params.connectors = [{ id: connector, state: `${connector}.foo` }];

  const intruderHeaders = await signIn();

  const intruder = await seed(intruderHeaders);

  const { body: spec } = await call(ownerHeaders, 'GET', '/openapi.json');

  const expanded = routes.map((route) => expand(spec, route, owner, intruder));

  const cases = expanded.flatMap(({ cases: made }) => made);

  const foreign = cases.filter((made) => made.foreign);

  const reads = cases.filter((made) => !made.foreign && made.method === 'GET');

  const snapshot = async () =>
    (await sweep(ownerHeaders, reads)).map(({ path, status, text }) => [
      path,
      status,
      text.replace(/"exportedAt":"[^"]*"/, ''),
    ]);

  const before = await snapshot();

  const crossing = await sweep(intruderHeaders, foreign);

  const fresh = await sweep(
    () => signIn(),
    cases.filter((made) => !made.foreign)
  );

  const after = await snapshot();

  const anonymous = await sweep(new Headers(), cases);

  const controls = await sweep(
    ownerHeaders,
    foreign.filter(({ method }) => method === 'GET')
  );

  await mcp.stop();

  expect({
    after,
    anonymous: failures(
      anonymous,
      ({ method, path, status }) =>
        status !== 401 && !open.has(`${method} ${path}`)
    ),
    controls: failures(controls, ({ status }) =>
      [401, 403, 404].includes(status)
    ),
    foreign: failures(
      crossing,
      ({ status }) => status !== 403 && status !== 404
    ),
    leaks: failures([...crossing, ...fresh], ({ text }) =>
      text.includes(secret)
    ),
    missing: expanded.flatMap(({ missing }) => missing),
    seen: JSON.stringify(before).includes(secret),
  }).toEqual({
    after: before,
    anonymous: [],
    controls: [],
    foreign: [],
    leaks: [],
    missing: [],
    seen: true,
  });
});
