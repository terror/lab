import { renderWithQuery, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

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
