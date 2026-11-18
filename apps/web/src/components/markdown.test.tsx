import { renderWithQuery, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';
import '@/index.css';

import { Markdown } from './markdown';

test('mermaid code blocks render as diagrams', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(
    <Markdown streaming={false}>
      {'```mermaid\nflowchart LR\n  foo --> bar\n```'}
    </Markdown>
  );

  await expect
    .poll(
      () =>
        [...screen.container.querySelectorAll('svg .nodeLabel')].map(
          (node) => node.textContent
        ),
      { timeout: 15_000 }
    )
    .toEqual(['foo', 'bar']);
});

test('mermaid diagrams follow theme switches', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(
    <Markdown streaming={false}>
      {'```mermaid\nflowchart LR\n  foo --> bar\n```'}
    </Markdown>
  );

  const fill = () => {
    const node = screen.container.querySelector('svg .node rect');

    return node ? getComputedStyle(node).fill : undefined;
  };

  await expect.poll(fill, { timeout: 10_000 }).toBe('rgb(238, 238, 238)');

  document.documentElement.classList.add('dark');

  await expect.poll(fill, { timeout: 10_000 }).toBe('rgb(31, 32, 32)');

  document.documentElement.classList.remove('dark');
});

test('finished messages are not patched as if they were cut off', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(
    <Markdown streaming={false}>{'**foo** *bar'}</Markdown>
  );

  await expect.element(screen.getByText('foo')).toBeVisible();

  expect(screen.container.textContent).toBe('foo *bar');
});

test('single line breaks are kept', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(
    <Markdown streaming={false}>{'foo\nbar'}</Markdown>
  );

  await expect
    .poll(() => screen.container.querySelector('p')?.innerHTML)
    .toBe('foo<br>\nbar');
});

test('streamed words fade in', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(
    <Markdown streaming>{'foo bar'}</Markdown>
  );

  await expect
    .poll(() =>
      [...screen.container.querySelectorAll('[data-sd-animate]')].map(
        (word) => getComputedStyle(word).animationName
      )
    )
    .toEqual(['sd-fadeIn', 'sd-fadeIn']);
});
