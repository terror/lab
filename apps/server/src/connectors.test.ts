import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { afterEach, expect, test } from 'bun:test';

import { signIn, signInAdmin } from '../test/auth';
import { call, chat, settle, toolDetails, toolOutputs } from '../test/client';
import { serveMcp } from '../test/mcp';
import { script, toolCall } from '../test/models';

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

test('the agent manages connectors with the user’s approval', async () => {
  const headers = await signInAdmin();

  const url = mcp();

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
      `Added the connector.\n- [${connector.id}] Foo (${url}): connected, 2 tools`,
      `- [${connector.id}] Foo (${url}): connected, 2 tools`,
      `Updated the connector.\n- [${connector.id}] Bar (${url}): connected, 2 tools`,
      `Removed the connector.\n- [${connector.id}] Bar (${url}): connected, 2 tools`,
    ],
  });
});
