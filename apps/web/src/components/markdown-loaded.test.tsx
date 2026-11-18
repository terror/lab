import { renderWithQuery, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { Markdown, loadMarkdown } from './markdown';

test('markdown that has already loaded renders without its fallback', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  await loadMarkdown();

  const fallbacks = new Array<Element>();

  const observer = new MutationObserver(() => {
    fallbacks.push(...document.querySelectorAll('.whitespace-pre-wrap'));
  });

  observer.observe(document.body, { childList: true, subtree: true });

  const { screen } = await renderWithQuery(
    <Markdown streaming={false}>foo</Markdown>
  );

  await expect.element(screen.getByText('foo')).toBeVisible();

  observer.disconnect();

  expect(fallbacks).toEqual([]);
});
