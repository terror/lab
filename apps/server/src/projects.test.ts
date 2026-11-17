import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, chat, create, toolOutputs } from '../test/client';
import { prompts, script, toolCall } from '../test/models';

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
    listed: {
      projects: [{ id: body.project.id, instructions: '', name: 'bar' }],
    },
    missing: { body: { error: 'Project not found' }, status: 404 },
    project: [inside],
    recent: [loose],
    renamed: {
      project: { id: body.project.id, instructions: '', name: 'bar' },
    },
  });
});

test('the agent can create, rename, and move chats into projects', async () => {
  const headers = await signIn();

  const { body } = await call(headers, 'POST', '/projects', { name: 'foo' });

  const id = body.project.id;

  script(
    toolCall('project_create', { name: 'bar' }),
    toolCall('project_update', { id, name: 'baz' }),
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
      `Updated the project [${id}] baz.`,
      `Moved chat ${moved} into project ${id}.`,
      `[${created}] bar\n[${id}] baz`,
    ],
    project: [moved],
    projects: [
      { id: created, instructions: '', name: 'bar' },
      { id, instructions: '', name: 'baz' },
    ],
  });
});

test('project instructions follow the custom instructions in the prompt', async () => {
  const headers = await signIn();

  await call(headers, 'PATCH', '/memory', { instructions: 'foo' });

  const { body } = await call(headers, 'POST', '/projects', { name: 'bar' });

  await call(headers, 'PATCH', `/projects/${body.project.id}`, {
    instructions: 'baz',
  });

  prompts.length = 0;

  await chat(headers, { content: 'qux', projectId: body.project.id });

  const [prompt = {}] = prompts;

  const order = Object.keys(prompt);

  expect({
    memory: prompt.memory,
    order: order.indexOf('memory') < order.indexOf('project'),
    project: prompt.project,
  }).toEqual({
    memory: "<memory>\nThe user's custom instructions:\nfoo\n</memory>",
    order: true,
    project: `<project>\nThis chat is in the user's project [${body.project.id}] bar. You can list, create, rename, and change the instructions of projects and move chats between them with project_list, project_create, project_update, and chat_move.\n\nThe project's instructions apply to every chat in it and take precedence over the user's general custom instructions:\nbaz\n</project>`,
  });
});

test('chats can be moved into and out of projects', async () => {
  const headers = await signIn();

  const { body } = await call(headers, 'POST', '/projects', { name: 'foo' });

  const id = await create(headers);

  const into = await call(headers, 'PATCH', `/conversations/${id}`, {
    projectId: body.project.id,
  });

  const inside = await ids(headers, `filter=all&project=${body.project.id}`);

  const missing = await call(headers, 'PATCH', `/conversations/${id}`, {
    projectId: body.project.id + 1,
  });

  await call(headers, 'PATCH', `/conversations/${id}`, { projectId: null });

  expect({
    inside,
    into,
    missing,
    recent: await ids(headers, 'filter=recent'),
  }).toEqual({
    inside: [id],
    into: { body: null, status: 204 },
    missing: { body: { error: 'Project not found' }, status: 404 },
    recent: [id],
  });
});
