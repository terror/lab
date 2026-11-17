import { renderWithQuery, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { catalog } from '../../.storybook/fixtures';
import { ModelPicker } from './model-picker';
import { ProviderLogo } from './provider-logo';

function mask(element: Element | null) {
  return element?.querySelector<HTMLElement>('[style*="mask-image"]')?.style
    .maskImage;
}

test('models show the logo of the provider they come through', async () => {
  const [model] = catalog.models;

  stubFetch(() =>
    Response.json({
      ...catalog,
      models: [
        {
          ...model,
          id: 'anthropic/claude-sonnet-5.5',
          provider: 'vercel-ai-gateway',
          providerName: 'Vercel AI Gateway',
        },
      ],
    })
  );

  const { screen } = await renderWithQuery(
    <ModelPicker
      onChange={() => undefined}
      value={{
        id: 'anthropic/claude-sonnet-5.5',
        provider: 'vercel-ai-gateway',
        thinkingLevel: 'off',
      }}
    />
  );

  await screen.getByRole('button', { name: /^Model: / }).click();

  const option = screen.getByRole('menuitem', { name: /^Claude/ });

  await expect.element(option).toBeVisible();

  const vercel = await render(<ProviderLogo id='vercel' name='foo' />);

  expect(mask(option.element())).toBe(mask(vercel.container));
});
