import { renderWithQuery, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { catalog } from '../../.storybook/fixtures';
import { ModelPicker } from './model-picker';

test('models show their provider’s logo', async () => {
  stubFetch(() => Response.json(catalog));

  const { screen } = await renderWithQuery(
    <ModelPicker
      onChange={() => undefined}
      value={{
        id: 'claude-sonnet-5.5',
        provider: 'anthropic',
        thinkingLevel: 'off',
      }}
    />
  );

  await screen
    .getByRole('button', { name: 'Model: Claude Sonnet 5.5' })
    .click();

  const option = screen.getByRole('menuitem', { name: /^Claude Sonnet 5\.5/ });

  await expect.element(option).toBeVisible();

  expect(
    option.element().querySelector('[style*="mask-image"]')
  ).not.toBeNull();
});
