import { renderWithQuery, stubFetch } from '@/test/helpers';
import { expect, test, vi } from 'vitest';
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

test('on a phone the picker opens as a sheet that asks how much a model thinks', async () => {
  stubFetch(() => Response.json(catalog));

  const matchMedia = window.matchMedia.bind(window);

  vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
    matchMedia(
      query === '(pointer: coarse) and (max-width: 767px)' ? 'all' : query
    )
  );

  const onChange = vi.fn();

  const { screen } = await renderWithQuery(
    <ModelPicker
      onChange={onChange}
      value={{ id: 'gpt-5.5', provider: 'openai', thinkingLevel: 'off' }}
    />
  );

  await screen.getByRole('button', { name: 'Model: GPT-5.5' }).click();

  const sheet = screen.getByRole('dialog', { name: 'Model' });

  await sheet.getByLabelText('Search models').fill('haiku');
  await sheet.getByRole('button', { name: 'Claude Haiku 5.5' }).click();
  await screen
    .getByRole('dialog', { name: 'Claude Haiku 5.5' })
    .getByRole('button', { name: 'High' })
    .click();

  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();

  expect(onChange.mock.calls).toEqual([
    [{ id: 'claude-haiku-5.5', provider: 'anthropic', thinkingLevel: 'high' }],
  ]);
});
