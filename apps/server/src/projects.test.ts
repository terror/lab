import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, chat, create, toolOutputs } from '../test/client';
import { script, toolCall } from '../test/models';

async function ids(headers: Headers, query: string) {
  const { body } = await call(headers, 'GET', `/conversations?${query}`);

  return body.conversations.map(({ id }: { id: number }) => id);
}

test('chats started in a project list there instead of in recents', async () => {
  const headers = await signIn();

  const { body } = await call(headers, 'POST', '/projects', { name: 'foo' });

  const renamed = await call(headers, 'PATCH', `/projects/${body.project.id}`, {
    name: 'bar',
  });

  const loose = await create(headers);

  const inside = await chat(headers, {
    content: 'baz',
    projectId: body.project.id,
  });

  const missing = await call(headers, 'POST', '/conversations', {
    content: 'baz',
    projectId: body.project.id + 1,
  });

  expect({
    listed: (await call(headers, 'GET', '/projects')).body,
    missing,
    project: await ids(headers, `filter=all&project=${body.project.id}`),
    recent: await ids(headers, 'filter=recent'),
    renamed: renamed.body,
  }).toEqual({
    listed: { projects: [{ id: body.project.id, name: 'bar' }] },
    missing: { body: { error: 'Project not found' }, status: 404 },
    project: [inside],
    recent: [loose],
    renamed: { project: { id: body.project.id, name: 'bar' } },
  });
});

test('the agent can create, rename, and move chats into projects', async () => {
  const headers = await signIn();

  const { body } = await call(headers, 'POST', '/projects', { name: 'foo' });

  const id = body.project.id;

  script(
    toolCall('project_create', { name: 'bar' }),
    toolCall('project_rename', { id, name: 'baz' }),
    toolCall('chat_move', { project_id: id }),
    toolCall('project_list', {}),
    fauxAssistantMessage('qux')
  );

  const moved = await chat(headers, { content: 'foo' });

  const { projects } = (await call(headers, 'GET', '/projects')).body;

  const created = projects[0].id;

  expect({
    outputs: await toolOutputs(headers, moved),
    project: await ids(headers, `filter=all&project=${id}`),
    projects,
  }).toEqual({
    outputs: [
      `Created the new project [${created}] bar.`,
      `Renamed the project to [${id}] baz.`,
      `Moved chat ${moved} into project ${id}.`,
      `[${created}] bar\n[${id}] baz`,
    ],
    project: [moved],
    projects: [
      { id: created, name: 'bar' },
      { id, name: 'baz' },
    ],
  });
});
