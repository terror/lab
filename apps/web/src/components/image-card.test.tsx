import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import '@/index.css';

import { ImageCard } from './image-card';

const pixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

test('an image develops from blurred and grey once it loads', async () => {
  const screen = await render(<ImageCard name='foo' src={pixel} />);

  const image = screen.getByRole('img', { name: 'foo' });

  await expect.element(image).toHaveAttribute('data-loaded');

  expect(getComputedStyle(image.element()).animationName).toBe('develop');
});
