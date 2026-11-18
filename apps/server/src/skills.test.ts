import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { skills as extension } from '@lab/harness';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, chat, settle, toolDetails, toolOutputs } from '../test/client';
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

async function answered(headers: Headers, answers: Record<string, string>) {
  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  for (const [callId, answer] of Object.entries(answers)) {
    await call(headers, 'POST', `/conversations/${body.id}/answers`, {
      answer,
      callId,
    });
  }

  await settle(body.id);

  return body.id as number;
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
    toolCall(
      'skill_create',
      { description: 'foo', instructions: 'bar', name: 'baz' },
      'foo'
    ),
    fauxAssistantMessage('foo')
  );

  const created = await answered(headers, { foo: 'approved' });

  const [{ id }] = (await call(headers, 'GET', '/skills')).body.skills;

  script(
    toolCall('skill_read', { id }),
    toolCall('skill_update', { id, instructions: 'qux' }, 'bar'),
    toolCall('skill_delete', { id }),
    toolCall('skill_read', { id }),
    fauxAssistantMessage('foo')
  );

  const changed = await answered(headers, { bar: 'approved' });

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

test('the agent saves or changes a skill only once the user approves', async () => {
  const headers = await signIn();

  const { body } = await call(headers, 'POST', '/skills', {
    description: 'foo',
    instructions: 'bar',
    name: 'baz',
  });

  const [{ id }] = body.skills;

  script(
    toolCall(
      'skill_create',
      { description: 'foo', instructions: 'bar', name: 'qux' },
      'foo'
    ),
    toolCall('skill_update', { id, instructions: 'qux' }, 'bar'),
    fauxAssistantMessage('foo')
  );

  const denied = await answered(headers, { bar: 'denied', foo: 'denied' });

  expect({
    details: await toolDetails(headers, denied),
    outputs: await toolOutputs(headers, denied),
    skills: await listed(headers),
  }).toEqual({
    details: [
      {
        approval: {
          action: 'Save the “qux” skill',
          decision: 'denied',
          summary: ['foo', 'bar'],
        },
      },
      {
        approval: {
          action: 'Change the “baz” skill',
          decision: 'denied',
          summary: ['Instructions: qux'],
        },
      },
    ],
    outputs: [
      'The user declined to save this skill.',
      'The user declined to change this skill.',
    ],
    skills: [{ description: 'foo', instructions: 'bar', name: 'baz' }],
  });
});

test('tools that change saved instructions are only offered to the model', async () => {
  const headers = await signIn();

  script(
    toolCall('codemode', {
      code: 'const names = new Set(ALL_TOOLS.map(({ name }) => name)); return ["project_update", "skill_create", "skill_read", "skill_update"].filter((name) => names.has(name));',
    }),
    fauxAssistantMessage('foo')
  );

  const outputs = await toolOutputs(
    headers,
    await chat(headers, { content: 'foo' })
  );

  expect(outputs).toHaveLength(1);

  expect(outputs[0]).toMatch(
    /^Script completed\nWall time \d+\.\d seconds\nOutput:\n\["skill_read"\]$/
  );
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
