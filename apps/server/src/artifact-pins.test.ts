import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { artifactChat, call, settle } from '../test/client';
import { script, toolCall } from '../test/models';

test('artifacts pin to the sidebar or a project and hide with their chat or project', async () => {
  const headers = await signIn();

  const id = await artifactChat(headers);

  const [mine, theirs] = await Promise.all([
    call(headers, 'POST', '/projects', { name: 'foo' }),
    call(await signIn(), 'POST', '/projects', { name: 'bar' }),
  ]);

  const artifact = `/conversations/${id}/artifacts/bar`;

  const pin = (projectId: number | null, path = artifact) =>
    call(headers, 'PUT', `${path}/pin`, { projectId });

  const pins = async () =>
    (await call(headers, 'GET', '/conversations/pins')).body.pins;

  await pin(null);

  const sidebar = await pins();

  await pin(mine.body.project.id);

  const project = await pins();

  const foreign = await pin(theirs.body.project.id);

  const missing = await pin(null, `/conversations/${id}/artifacts/qux`);

  const content = await call(headers, 'GET', artifact);

  await call(headers, 'DELETE', `/conversations/${id}`);

  const trashed = {
    content: await call(headers, 'GET', artifact),
    pins: await pins(),
  };

  await call(headers, 'POST', `/trash/conversation/${id}/restore`);

  const restored = await pins();

  await call(headers, 'DELETE', `${artifact}/pin`);

  const unpinned = await pins();

  await pin(mine.body.project.id);

  await call(headers, 'DELETE', `/projects/${mine.body.project.id}`);

  expect({
    content,
    foreign,
    missing,
    project,
    restored,
    sidebar,
    trashed,
    trashedProject: await pins(),
    unpinned,
  }).toEqual({
    content: {
      body: { content: '<p>foo</p>', title: 'Baz', version: 1 },
      status: 200,
    },
    foreign: { body: { error: 'Project not found' }, status: 404 },
    missing: { body: { error: 'Artifact not found' }, status: 404 },
    project: [
      {
        artifactId: 'bar',
        conversationId: id,
        projectId: mine.body.project.id,
        title: 'Baz',
        seenVersion: 1,
        version: 1,
      },
    ],
    restored: [
      {
        artifactId: 'bar',
        conversationId: id,
        projectId: mine.body.project.id,
        title: 'Baz',
        seenVersion: 1,
        version: 1,
      },
    ],
    sidebar: [
      {
        artifactId: 'bar',
        conversationId: id,
        projectId: null,
        seenVersion: 1,
        title: 'Baz',
        version: 1,
      },
    ],
    trashed: {
      content: { body: { error: 'Conversation not found' }, status: 404 },
      pins: [],
    },
    trashedProject: [],
    unpinned: [],
  });
});

test('a pin remembers the version last opened until it is seen again', async () => {
  const headers = await signIn();

  const id = await artifactChat(headers);

  const artifact = `/conversations/${id}/artifacts/bar`;

  const versions = async () =>
    (await call(headers, 'GET', '/conversations/pins')).body.pins.map(
      ({ seenVersion, version }: { seenVersion: number; version: number }) => [
        seenVersion,
        version,
      ]
    );

  await call(headers, 'PUT', `${artifact}/pin`, { projectId: null });

  const pinned = await versions();

  script(
    toolCall('artifact_update', { content: '<p>baz</p>', id: 'bar' }),
    fauxAssistantMessage('qux')
  );

  await call(headers, 'POST', `/conversations/${id}/messages`, {
    content: 'foo',
  });

  await settle(id);

  const updated = await versions();

  const seen = await call(headers, 'POST', `${artifact}/pin/seen`);

  expect({ after: await versions(), pinned, seen, updated }).toEqual({
    after: [[2, 2]],
    pinned: [[1, 1]],
    seen: { body: null, status: 204 },
    updated: [[1, 2]],
  });
});
