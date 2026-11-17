import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { AssistantMessage } from './assistant-message';

const parts = [
  {
    arguments: { query: 'foo' },
    id: 'a',
    name: 'web_search',
    type: 'toolCall',
  },
  { text: 'bar', type: 'text' },
  {
    arguments: { url: 'https://foo.com' },
    id: 'b',
    name: 'web_fetch',
    type: 'toolCall',
  },
  { text: 'baz', type: 'text' },
] as const;

const results = new Map([
  ['a', { isError: false, output: 'foo' }],
  ['b', { isError: true, output: 'bar' }],
]);

test('a finished turn folds its steps behind how long it worked', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(
    <TooltipProvider>
      <AssistantMessage
        parts={parts}
        progress={new Map()}
        results={results}
        span={{ end: 151_000, start: 0 }}
        streaming={false}
      />
    </TooltipProvider>
  );

  const fold = screen.getByRole('button', {
    name: 'Worked for 2m 31s · 2 steps · 1 failed',
  });

  await expect.element(fold).toHaveAttribute('aria-expanded', 'false');
  await expect.element(screen.getByText('baz')).toBeVisible();
  await expect.element(screen.getByText('bar')).not.toBeInTheDocument();

  await fold.click();

  await expect.element(screen.getByText('bar')).toBeVisible();
});

test('a running turn shows only its current step under a clock', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(
    <AssistantMessage
      parts={parts.slice(0, 3)}
      progress={new Map()}
      results={new Map([['a', { isError: false, output: 'foo' }]])}
      span={{ end: Date.now(), start: Date.now() }}
      streaming
      working
    />
  );

  await expect
    .element(screen.getByRole('button', { name: 'Working · 0:00 · 2 steps' }))
    .toBeVisible();
  await expect.element(screen.getByText('Reading a page')).toBeVisible();
  await expect
    .element(screen.getByText('Searched the web'))
    .not.toBeInTheDocument();
});
