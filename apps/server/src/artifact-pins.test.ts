import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { artifactChat, call } from '../test/client';

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
      },
    ],
    restored: [
      {
        artifactId: 'bar',
        conversationId: id,
        projectId: mine.body.project.id,
        title: 'Baz',
      },
    ],
    sidebar: [
      { artifactId: 'bar', conversationId: id, projectId: null, title: 'Baz' },
    ],
    trashed: {
      content: { body: { error: 'Conversation not found' }, status: 404 },
      pins: [],
    },
    trashedProject: [],
    unpinned: [],
  });
});
