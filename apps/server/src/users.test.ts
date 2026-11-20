import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { defineDoc } from '@earendil-works/pi-durable';
import { MemoryDoc, ProfileDoc, adoptGlobalDocs } from '@lab/harness';
import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';

import { signIn } from '../test/auth';
import { call, chat } from '../test/client';
import { script, toolCall } from '../test/models';
import { harness } from './harness';
import { conversationOwner } from './records';

async function settings(headers: Headers) {
  return {
    memory: (await call(headers, 'GET', '/memory')).body,
    preferences: (await call(headers, 'GET', '/preferences')).body,
    skills: (await call(headers, 'GET', '/skills')).body,
  };
}

async function timezone(ownerId: string | undefined) {
  return (
    await harness().snapshot(ProfileDoc, ownerId ?? '', BACKGROUND_CONTEXT)
  )?.timezone;
}

test('settings and memories belong to the user who made them', async () => {
  const foo = await signIn();
  const bar = await signIn();

  const empty = await settings(bar);

  script(toolCall('remember', { text: 'baz' }), fauxAssistantMessage('qux'));

  const id = await chat(foo, { content: 'foo' });

  await call(foo, 'PATCH', '/memory', { instructions: 'foo' });
  await call(foo, 'PATCH', '/preferences', { theme: 'dark' });
  await call(foo, 'POST', '/skills', {
    description: 'foo',
    instructions: 'bar',
    name: 'baz',
  });
  await call(foo, 'PUT', '/schedules/timezone', { timezone: 'Asia/Tokyo' });

  const [fooId, barId] = await Promise.all([
    conversationOwner(id),
    conversationOwner(await chat(bar, { content: 'bar' })),
  ]);

  expect({
    bar: await settings(bar),
    fooMemories: (await settings(foo)).memory.memories.map(
      ({ text }: { text: string }) => text
    ),
    timezones: [await timezone(fooId), await timezone(barId)],
  }).toEqual({
    bar: empty,
    fooMemories: ['baz'],
    timezones: ['Asia/Tokyo', undefined],
  });
});

test('global settings from before users are adopted once', async () => {
  const legacy = defineDoc<{ instructions: string; memories: never[] }>({
    checkpointWhen: () => true,
    initial: () => ({ instructions: '', memories: [] }),
    kind: 'lab.memory',
    scope: 'session',
    version: 1,
  });

  await harness().commit(async (tx) => {
    (await tx.doc(legacy)).instructions = 'foo';
  }, BACKGROUND_CONTEXT);

  const ownerId = randomUUID();

  const instructions = async () =>
    (await harness().snapshot(MemoryDoc, ownerId, BACKGROUND_CONTEXT))
      ?.instructions;

  await adoptGlobalDocs(harness(), ownerId, BACKGROUND_CONTEXT);

  const adopted = await instructions();

  await harness().commit(async (tx) => {
    (await tx.doc(MemoryDoc, ownerId, null)).instructions = 'bar';
  }, BACKGROUND_CONTEXT);

  await adoptGlobalDocs(harness(), ownerId, BACKGROUND_CONTEXT);

  expect([adopted, await instructions()]).toEqual(['foo', 'bar']);
});
