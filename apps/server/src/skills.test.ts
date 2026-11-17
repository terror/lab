import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { skills as extension } from '@lab/harness';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, chat, toolDetails, toolOutputs } from '../test/client';
import { script, toolCall } from '../test/models';

type Listed = {
  description: string;
  id: string;
  instructions: string;
  name: string;
};

function fields({ description, instructions, name }: Listed) {
  return { description, instructions, name };
}

async function listed(headers: Headers) {
  const { body } = await call(headers, 'GET', '/skills');

  return (body.skills as Listed[]).map(fields);
}

test('skills can be managed from settings', async () => {
  const headers = await signIn();

  const created = await call(headers, 'POST', '/skills', {
    description: 'foo',
    instructions: 'bar',
    name: 'baz',
  });

  const [{ id }] = created.body.skills;

  const duplicate = await call(headers, 'POST', '/skills', {
    description: 'foo',
    instructions: 'bar',
    name: 'BAZ',
  });

  await call(headers, 'PATCH', `/skills/${id}`, { instructions: 'qux' });

  const updated = await listed(headers);

  await call(headers, 'DELETE', `/skills/${id}`);

  expect({
    after: await listed(headers),
    created: created.status,
    duplicate,
    missing: (await call(headers, 'DELETE', `/skills/${id}`)).status,
    updated,
  }).toEqual({
    after: [],
    created: 201,
    duplicate: {
      body: { error: 'A skill with that name already exists' },
      status: 409,
    },
    missing: 404,
    updated: [{ description: 'foo', instructions: 'qux', name: 'baz' }],
  });
});

test('the agent creates, reads, updates, and deletes skills', async () => {
  const headers = await signIn();

  script(
    toolCall('skill_create', {
      description: 'foo',
      instructions: 'bar',
      name: 'baz',
    }),
    fauxAssistantMessage('foo')
  );

  const created = await chat(headers, { content: 'foo' });

  const [{ id }] = (await call(headers, 'GET', '/skills')).body.skills;

  script(
    toolCall('skill_read', { id }),
    toolCall('skill_update', { id, instructions: 'qux' }),
    toolCall('skill_delete', { id }),
    toolCall('skill_read', { id }),
    fauxAssistantMessage('foo')
  );

  const changed = await chat(headers, { content: 'foo' });

  const details = [
    ...(await toolDetails(headers, created)),
    ...(await toolDetails(headers, changed)),
  ].map((detail) => detail && fields(detail as Listed));

  expect({
    details,
    outputs: await toolOutputs(headers, changed),
    skills: await listed(headers),
  }).toEqual({
    details: [
      { description: 'foo', instructions: 'bar', name: 'baz' },
      { description: 'foo', instructions: 'bar', name: 'baz' },
      { description: 'foo', instructions: 'qux', name: 'baz' },
      { description: 'foo', instructions: 'qux', name: 'baz' },
      undefined,
    ],
    outputs: [
      '# baz\n\nbar',
      `Updated the skill [${id}] baz.\n\nYour list of saved skills now shows this version.`,
      `Deleted the skill [${id}] baz.`,
      'No skill has that id.',
    ],
    skills: [],
  });
});

test('saved skills are listed in the prompt', async () => {
  const [section] = extension(async () => 'foo').sections ?? [];

  const render = (skills: unknown[]) =>
    section?.render(
      {
        read: { snapshot: async () => ({ skills }) },
      } as unknown as Parameters<NonNullable<typeof section>['render']>[0],
      BACKGROUND_CONTEXT
    );

  expect(
    await render([{ description: 'foo', id: 'bar', name: 'baz' }])
  ).toEqual(
    'Skills are reusable instructions the user has saved. When a request matches a skill, read it with skill_read and follow its instructions. Create, update, or delete skills with skill_create, skill_update, and skill_delete when the user asks.\nSaved skills, with their ids:\n- [bar] baz: foo'
  );
});
