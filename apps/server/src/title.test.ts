import { plainTitle } from '@lab/harness';
import { expect, spyOn, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, idle } from '../test/client';
import { models } from './models';

test('titles are written by the helper model from a short transcript', async () => {
  const complete = spyOn(models, 'completeSimple');

  const { body } = await call(await signIn(), 'POST', '/conversations', {
    content: 'foo'.repeat(1_000),
    model: { id: 'alibaba/qwen3-coder', provider: 'vercel-ai-gateway' },
  });

  await idle(body.id);

  const [model, request] = complete.mock.calls.at(-1) ?? [];

  expect({
    length: request?.messages[0]?.content.length,
    model: model?.id,
  }).toEqual({ length: 2_022, model: 'anthropic/claude-haiku-5.5' });

  complete.mockRestore();
});

test('a rename during title generation is kept', async () => {
  const headers = await signIn();

  const complete = models.completeSimple.bind(models);

  const { promise: created, resolve } = Promise.withResolvers<number>();

  const spy = spyOn(models, 'completeSimple').mockImplementationOnce(
    async (...args) => {
      await call(headers, 'PATCH', `/conversations/${await created}`, {
        title: 'bar',
      });

      return complete(...args);
    }
  );

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  resolve(body.id);

  await idle(body.id);

  spy.mockRestore();

  expect(
    (await call(headers, 'GET', `/conversations/${body.id}`)).body.title
  ).toBe('bar');
});

function plain(value: string, expected: string) {
  expect(plainTitle(value)).toBe(expected);
}

test('generated titles are plain text', () => {
  plain('**Foo Bar**', 'Foo Bar');
  plain('"Foo Bar."', 'Foo Bar');
  plain('# Foo `bar`', 'Foo bar');
  plain('Foo\nBar', 'Foo');
  plain('foo_bar __baz__', 'foo_bar baz');
});
