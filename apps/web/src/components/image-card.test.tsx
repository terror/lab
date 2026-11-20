import { preferencesQueryOptions } from '@/lib/preferences';
import { renderWithQuery } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { expect, test, vi } from 'vitest';
import '@/index.css';

import { ImageCard } from './image-card';
import { imageRenderers } from './tools/images';

const pixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const square = vi.hoisted(
  () =>
    `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"/>')}`
);

vi.mock('@/lib/uploads', () => ({ uploadUrl: () => square }));

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

test('a generated image keeps the square frame it reserved while it was being made', async () => {
  const view = {
    active: true,
    args: {},
    callId: 'foo',
    details: undefined,
    history: [],
    output: '',
  };

  const { screen } = await renderWithQuery(
    imageRenderers.image_generate.inline(view)
  );

  const frame = () => {
    const box = screen.container.firstElementChild;

    return {
      height: box?.getBoundingClientRect().height,
      skeleton: box?.querySelector('[data-slot="skeleton"]') !== null,
      width: box?.getBoundingClientRect().width,
    };
  };

  const reserved = frame();

  await screen.rerender(
    imageRenderers.image_generate.inline({
      ...view,
      active: false,
      details: { name: 'bar', uploadId: 'baz' },
    })
  );

  await expect
    .element(screen.getByRole('img', { name: 'bar' }))
    .toHaveAttribute('data-loaded');

  expect([reserved, frame()]).toEqual([
    { height: 288, skeleton: true, width: 288 },
    { height: 288, skeleton: false, width: 288 },
  ]);
});
