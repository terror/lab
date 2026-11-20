import { renderWithQuery } from '@/test/helpers';
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

test('an image develops from blurred and grey once it loads', async () => {
  const { screen } = await renderWithQuery(
    <ImageCard name='foo' src={pixel} />
  );

  const image = screen.getByRole('img', { name: 'foo' });

  await expect.element(image).toHaveAttribute('data-loaded');

  expect(getComputedStyle(image.element()).animationName).toBe('develop');
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
