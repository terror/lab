import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { ProjectInstructions } from './project-instructions';

test('saving instructions updates the project', async () => {
  const fetch = stubFetch(() =>
    Response.json({ project: { id: 7, instructions: 'baz', name: 'foo' } })
  );

  const { screen } = await renderWithQuery(
    <ProjectInstructions
      project={{ id: 7, instructions: 'bar', name: 'foo' }}
    />
  );

  await screen.getByRole('button', { name: 'Edit instructions' }).click();
  await screen.getByRole('textbox', { name: 'Instructions' }).fill('baz');
  await screen.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() =>
      fetch.mock.calls.flatMap(([input, init]) =>
        init?.method === 'PATCH'
          ? [[requestUrl(input).pathname, init.body]]
          : []
      )
    )
    .toEqual([['/api/projects/7', JSON.stringify({ instructions: 'baz' })]]);
});
