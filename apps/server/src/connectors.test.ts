import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { schema } from '@lab/db';
import { afterEach, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { signIn, signInAdmin } from '../test/auth';
import {
  call,
  chat,
  raw,
  settle,
  toolDetails,
  toolOutputs,
} from '../test/client';
import { serveEndlessMcp, serveMcp, serveProtectedMcp } from '../test/mcp';
import { script, toolCall } from '../test/models';
import { refreshConnector } from './connections';
import { db } from './db';
import { env } from './env';
import { registry } from './registry';

const servers: { stop: () => void }[] = [];

function mcp() {
  const server = serveMcp();

  servers.push(server);

  return server.url;
}

afterEach(async () => {
  const headers = await signInAdmin();

  const { body } = await call(headers, 'GET', '/connectors');

  for (const { id } of body.connectors) {
    await call(headers, 'DELETE', `/connectors/${id}`);
  }

  for (const server of servers.splice(0)) {
    server.stop();
  }
});

test('connectors list the tools of their server', async () => {
  const headers = await signInAdmin();

  const url = mcp();

  const { body, status } = await call(headers, 'POST', '/connectors', {
    name: 'Foo',
    url,
  });

  expect({ body, status }).toEqual({
    body: {
      connectors: [
        {
          enabled: true,
          error: null,
          id: body.connectors[0].id,
          name: 'Foo',
          status: 'connected',
          tools: [
            { description: 'bar', name: 'read' },
            { description: 'baz', name: 'write' },
          ],
          url,
        },
      ],
    },
    status: 201,
  });
});

test('connectors can be turned off, renamed only to unique names, and deleted', async () => {
  const headers = await signInAdmin();

  await call(headers, 'POST', '/connectors', { name: 'Foo', url: mcp() });

  const { body } = await call(headers, 'POST', '/connectors', {
    name: 'Bar',
    url: mcp(),
  });

  const [foo, bar] = body.connectors;

  expect(
    await call(headers, 'PATCH', `/connectors/${bar.id}`, { name: 'foo' })
  ).toEqual({
    body: { error: 'A connector with that name already exists' },
    status: 409,
  });

  const off = await call(headers, 'PATCH', `/connectors/${foo.id}`, {
    enabled: false,
  });

  expect(
    off.body.connectors.map(
      ({ status, tools }: { status: string; tools: unknown[] }) => [
        status,
        tools.length,
      ]
    )
  ).toEqual([
    ['off', 0],
    ['connected', 2],
  ]);

  await call(headers, 'DELETE', `/connectors/${foo.id}`);

  expect(
    (await call(headers, 'GET', '/connectors')).body.connectors.map(
      ({ name }: { name: string }) => name
    )
  ).toEqual(['Bar']);
});

test('unreachable connectors report why', async () => {
  const headers = await signInAdmin();

  const { body } = await call(headers, 'POST', '/connectors', {
    name: 'Foo',
    url: 'http://127.0.0.1:1/mcp',
  });

  expect([body.connectors[0].status, body.connectors[0].error]).toEqual([
    'error',
    'ECONNREFUSED: Unable to connect. Is the computer able to access the url?',
  ]);
});

test('servers that keep paging their tools fail to connect', async () => {
  const headers = await signInAdmin();

  const server = serveEndlessMcp();

  servers.push(server);

  const { body } = await call(headers, 'POST', '/connectors', {
    name: 'Foo',
    url: server.url,
  });

  expect([body.connectors[0].status, body.connectors[0].error]).toEqual([
    'error',
    'The server lists too many tools',
  ]);
});

test('the agent finds connector tools and asks before ones that change things', async () => {
  const headers = await signInAdmin();

  await call(headers, 'POST', '/connectors', { name: 'Foo', url: mcp() });

  script(
    toolCall('tool_search', { query: 'foo' }),
    toolCall('mcp__foo__read', { value: 'qux' }),
    toolCall('mcp__foo__write', { value: 'qux' }, 'baz'),
    fauxAssistantMessage('bar')
  );

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  await call(headers, 'POST', `/conversations/${body.id}/answers`, {
    answer: 'approved',
    callId: 'baz',
  });

  await settle(body.id);

  expect({
    details: (await toolDetails(headers, body.id)).slice(1),
    outputs: await toolOutputs(headers, body.id),
  }).toEqual({
    details: [
      undefined,
      {
        approval: {
          action: 'Use write from Foo',
          decision: 'approved',
          summary: ['value: "qux"'],
        },
      },
    ],
    outputs: [
      'Loaded 2 tools. They are available from your next call:\n- mcp__foo__read: bar\n- mcp__foo__write: baz',
      'read qux',
      'wrote qux',
    ],
  });
});

test('connector approvals show every argument in full', async () => {
  const headers = await signInAdmin();

  await call(headers, 'POST', '/connectors', { name: 'Foo', url: mcp() });

  const value = 'a'.repeat(300);

  script(
    toolCall('tool_search', { query: 'foo' }),
    toolCall('mcp__foo__write', { value }, 'baz'),
    fauxAssistantMessage('bar')
  );

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  await call(headers, 'POST', `/conversations/${body.id}/answers`, {
    answer: 'denied',
    callId: 'baz',
  });

  await settle(body.id);

  expect((await toolDetails(headers, body.id))[1]).toEqual({
    approval: {
      action: 'Use write from Foo',
      decision: 'denied',
      summary: [`value: "${value}"`],
    },
  });
});

test('stopping a chat stops its connector call', async () => {
  const headers = await signInAdmin();

  const waiting = Promise.withResolvers<void>();

  const server = serveMcp([], waiting.resolve);

  servers.push(server);

  await call(headers, 'POST', '/connectors', { name: 'Foo', url: server.url });

  script(
    toolCall('tool_search', { query: 'wait' }),
    toolCall('mcp__foo__wait', {})
  );

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  await waiting.promise;

  const stopped = call(headers, 'POST', `/conversations/${body.id}/abort`);

  expect(
    await Promise.race([
      stopped.then(({ status }) => status),
      Bun.sleep(1_000).then(() => 'still running'),
    ])
  ).toBe(204);
});

test('connectors belong to the user who added them', async () => {
  const admin = await signInAdmin();
  const other = await signIn();

  const { body } = await call(admin, 'POST', '/connectors', {
    name: 'Foo',
    url: mcp(),
  });

  script(
    toolCall('tool_search', { query: 'foo' }),
    fauxAssistantMessage('bar')
  );

  const id = await chat(other, { content: 'foo' });

  expect({
    deleted: await call(
      other,
      'DELETE',
      `/connectors/${body.connectors[0].id}`
    ),
    listed: (await call(other, 'GET', '/connectors')).body,
    outputs: await toolOutputs(other, id),
  }).toEqual({
    deleted: { body: { error: 'Connector not found' }, status: 404 },
    listed: { connectors: [] },
    outputs: [
      '<harness>\n[error] Tool tool_search is not available\n</harness>',
    ],
  });
});

test('only the admin can connect to private addresses', async () => {
  expect(
    await call(await signIn(), 'POST', '/connectors', {
      name: 'Foo',
      url: mcp(),
    })
  ).toEqual({
    body: { error: 'Connectors can only reach public internet addresses' },
    status: 400,
  });
});

test('tools that ask the user are only offered to the model', async () => {
  const headers = await signInAdmin();

  await call(headers, 'POST', '/connectors', { name: 'Foo', url: mcp() });

  script(
    toolCall('codemode', {
      code: 'const names = new Set(ALL_TOOLS.map(({ name }) => name)); return ["connector_add", "connector_remove", "connector_update", "mcp__foo__read", "mcp__foo__write", "schedule_update"].filter((name) => names.has(name));',
    }),
    fauxAssistantMessage('bar')
  );

  const outputs = await toolOutputs(
    headers,
    await chat(headers, { content: 'foo' })
  );

  expect(outputs).toHaveLength(1);

  expect(outputs[0]).toMatch(
    /^Script completed\nWall time \d+\.\d seconds\nOutput:\n\["mcp__foo__read"\]$/
  );
});

test('the agent manages connectors with the user’s approval', async () => {
  const headers = await signInAdmin();

  const url = `${mcp()}?key=foo`;

  const { host } = new URL(url);

  script(
    toolCall('connector_add', { name: 'Foo', url }, 'foo'),
    toolCall('connector_list', {}),
    fauxAssistantMessage('bar')
  );

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  await call(headers, 'POST', `/conversations/${body.id}/answers`, {
    answer: 'approved',
    callId: 'foo',
  });

  await settle(body.id);

  const [connector] = (await call(headers, 'GET', '/connectors')).body
    .connectors;

  script(
    toolCall('connector_update', { id: connector.id, name: 'Bar' }),
    toolCall('connector_remove', { id: connector.id }, 'baz'),
    fauxAssistantMessage('bar')
  );

  await call(headers, 'POST', `/conversations/${body.id}/messages`, {
    content: 'bar',
  });

  await call(headers, 'POST', `/conversations/${body.id}/answers`, {
    answer: 'approved',
    callId: 'baz',
  });

  await settle(body.id);

  expect({
    connectors: (await call(headers, 'GET', '/connectors')).body.connectors,
    outputs: await toolOutputs(headers, body.id),
  }).toEqual({
    connectors: [],
    outputs: [
      `Added the connector.\n- [${connector.id}] Foo (${host}): connected, 2 tools`,
      `- [${connector.id}] Foo (${host}): connected, 2 tools`,
      `Updated the connector.\n- [${connector.id}] Bar (${host}): connected, 2 tools`,
      `Removed the connector.\n- [${connector.id}] Bar (${host}): connected, 2 tools`,
    ],
  });
});

test('connectors that need sign-in connect after the user authorizes them', async () => {
  const headers = await signInAdmin();

  const server = serveProtectedMcp();

  servers.push(server);

  const { body } = await call(headers, 'POST', '/connectors', {
    name: 'Foo',
    url: server.url,
  });

  const [connector] = body.connectors;

  const authorize = await raw(headers, `/connectors/${connector.id}/authorize`);

  const location = new URL(authorize.headers.get('location') ?? '');

  const state = location.searchParams.get('state') ?? '';

  const expired = await raw(
    headers,
    `/connectors/callback?code=baz&state=${connector.id}.qux`
  );

  const finished = await raw(
    headers,
    `/connectors/callback?code=baz&state=${encodeURIComponent(state)}`
  );

  const [after] = (await call(headers, 'GET', '/connectors')).body.connectors;

  expect({
    after: [after.status, after.tools.length],
    authorize: [authorize.status, location.pathname],
    before: connector.status,
    expired: [expired.status, await expired.json()],
    finished: [finished.status, finished.headers.get('location')],
  }).toEqual({
    after: ['connected', 2],
    authorize: [302, '/authorize'],
    before: 'unauthorized',
    expired: [
      400,
      { error: 'This sign-in expired. Sign in to the connector again.' },
    ],
    finished: [302, '/settings'],
  });
});

test('authorization servers can read Lab’s client metadata without signing in', async () => {
  expect(
    await call(new Headers(), 'GET', '/connectors/client-metadata.json')
  ).toEqual({
    body: {
      client_id: 'http://localhost:3000/api/connectors/client-metadata.json',
      client_name: 'Lab',
      grant_types: ['authorization_code', 'refresh_token'],
      redirect_uris: ['http://localhost:3000/api/connectors/callback'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
    status: 200,
  });
});

test('reconnecting while someone signs in does not expire their sign-in', async () => {
  const headers = await signInAdmin();

  const server = serveProtectedMcp();

  servers.push(server);

  const { body } = await call(headers, 'POST', '/connectors', {
    name: 'Foo',
    url: server.url,
  });

  const [connector] = body.connectors;

  const authorize = await raw(headers, `/connectors/${connector.id}/authorize`);

  const state =
    new URL(authorize.headers.get('location') ?? '').searchParams.get(
      'state'
    ) ?? '';

  await call(headers, 'POST', `/connectors/${connector.id}/reconnect`);

  const finished = await raw(
    headers,
    `/connectors/callback?code=baz&state=${encodeURIComponent(state)}`
  );

  expect([finished.status, finished.headers.get('location')]).toEqual([
    302,
    '/settings',
  ]);
});

test('tools whose names collide are all registered', async () => {
  const headers = await signInAdmin();

  const server = serveMcp(['foo.bar', 'foo_bar']);

  servers.push(server);

  await call(headers, 'POST', '/connectors', { name: 'Foo', url: server.url });

  const [owner] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, env.LAB_ADMIN_EMAIL));

  expect(
    registry
      .snapshot()
      .extension(`connectors-${owner?.id}`)
      ?.tools?.map(({ name }) => name)
  ).toEqual([
    'tool_search',
    'mcp__foo__foo_bar',
    'mcp__foo__foo_bar_2',
    'mcp__foo__read',
    'mcp__foo__write',
  ]);
});

test('refreshing a deleted connector does not bring it back', async () => {
  const headers = await signInAdmin();

  const { body } = await call(headers, 'POST', '/connectors', {
    name: 'Foo',
    url: mcp(),
  });

  const [row] = await db
    .select()
    .from(schema.connector)
    .where(eq(schema.connector.id, body.connectors[0].id));

  await call(headers, 'DELETE', `/connectors/${row?.id}`);

  await refreshConnector(row!);

  expect(
    registry.snapshot().extension(`connectors-${row?.ownerId}`)
  ).toBeUndefined();
});
