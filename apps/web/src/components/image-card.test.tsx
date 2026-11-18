import { preferencesQueryOptions } from '@/lib/preferences';
import { renderWithQuery } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { expect, test } from 'vitest';
import '@/index.css';

import { ImageCard } from './image-card';

const pixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

async function develop(personality: 'default' | 'quiet') {
  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, {
    ...defaultPreferences,
    personality,
  });

  const { screen } = await renderWithQuery(
    <ImageCard name='foo' src={pixel} />,
    client
  );

  const image = screen.getByRole('img', { name: 'foo' });

  await expect.element(image).toHaveAttribute('data-loaded');

  const { animationName } = getComputedStyle(image.element());

  await screen.unmount();

  return animationName;
}

test('an image develops from blurred and grey once it loads unless Lab is quiet', async () => {
  expect([await develop('default'), await develop('quiet')]).toEqual([
    'develop',
    'none',
  ]);
});
