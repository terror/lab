import { TooltipProvider } from '@/components/ui/tooltip';
import { preferencesQueryOptions } from '@/lib/preferences';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { expect, test, vi } from 'vitest';
import '@/index.css';

import { MessageActions } from './message-actions';

async function press(personality: 'default' | 'quiet') {
  stubFetch(() => Response.json({ default: null, models: [] }));

  const writeText = vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockResolvedValue();

  writeText.mockClear();

  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, {
    ...defaultPreferences,
    personality,
  });

  const { screen } = await renderWithQuery(
    <TooltipProvider>
      <MessageActions
        latest
        model={undefined}
        onRetry={() => undefined}
        spin
        text='foo'
        versions={null}
      />
    </TooltipProvider>,
    client
  );

  await screen.getByRole('button', { name: 'Copy' }).click();
  await screen.getByRole('button', { name: 'Retry' }).click();

  await expect
    .element(screen.getByRole('button', { name: 'Copied' }))
    .toBeVisible();

  const icon = screen.container.querySelector('[data-slot=copy-icon]');
  const back = icon?.querySelector('[data-part=back]');
  const spin = screen
    .getByRole('button', { name: 'Retry' })
    .element()
    .querySelector('svg');

  const pressed = {
    copied: icon?.getAttribute('data-state'),
    fold: back && getComputedStyle(back).transitionDuration,
    spin: spin && getComputedStyle(spin).animationName,
    text: [...writeText.mock.calls],
  };

  await screen.unmount();

  return pressed;
}

test('copy folds into a check and retry spins once, both still when Lab is quiet', async () => {
  expect([await press('default'), await press('quiet')]).toEqual([
    { copied: 'copied', fold: '0.14s, 0.14s', spin: 'retry', text: [['foo']] },
    { copied: 'copied', fold: '0s', spin: 'none', text: [['foo']] },
  ]);
});
