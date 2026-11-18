import { ToolConversation } from '@/components/tools';
import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { AssistantMessage, type ToolResult } from './assistant-message';

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

const results = new Map<string, ToolResult>([
  ['a', { output: 'foo', status: 'done' }],
  ['b', { output: 'bar', status: 'failed' }],
]);

test('a finished turn folds only its steps behind how long it worked', async () => {
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
    name: 'Worked for 2m 31s · 2 actions · 1 failed',
  });

  await expect.element(fold).toHaveAttribute('aria-expanded', 'false');
  await expect.element(screen.getByText('bar')).toBeVisible();
  await expect.element(screen.getByText('baz')).toBeVisible();
  await expect
    .element(screen.getByText('Couldn’t read a page'))
    .not.toBeInTheDocument();

  await fold.click();

  await expect.element(screen.getByText('Couldn’t read a page')).toBeVisible();
});

test('a running turn lists its finished steps above its current one', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(
    <AssistantMessage
      parts={parts.slice(0, 3)}
      progress={new Map()}
      results={new Map([['a', { output: 'foo', status: 'done' }]])}
      streaming
      working
    />
  );

  await expect
    .element(screen.getByRole('status'))
    .toHaveTextContent('Reading a page');
  await expect
    .element(screen.getByRole('button'))
    .toHaveTextContent('Searched the web for “foo”');
  await expect.element(screen.getByText('bar')).toBeVisible();
});

test('a pending question waits for an answer instead of working', async () => {
  const { screen } = await renderWithQuery(
    <AssistantMessage
      parts={[
        {
          arguments: { options: ['foo'], question: 'bar' },
          id: 'a',
          name: 'ask_user',
          type: 'toolCall',
        },
      ]}
      progress={new Map()}
      results={new Map()}
      streaming
      working
    />
  );

  await expect
    .element(screen.getByRole('status'))
    .toHaveTextContent('Waiting for your answer');
});

test('a stopped question or approval can no longer be answered', async () => {
  const { screen } = await renderWithQuery(
    <ToolConversation value={7}>
      <AssistantMessage
        parts={[
          {
            arguments: { options: ['foo'], question: 'bar' },
            id: 'a',
            name: 'ask_user',
            type: 'toolCall',
          },
          { arguments: {}, id: 'b', name: 'trash_purge', type: 'toolCall' },
        ]}
        progress={new Map()}
        results={
          new Map([
            [
              'a',
              {
                details: { options: ['foo'], question: 'bar' },
                output: '',
                status: 'stopped',
              },
            ],
            [
              'b',
              {
                details: { approval: { action: 'baz', summary: ['qux'] } },
                output: '',
                status: 'stopped',
              },
            ],
          ])
        }
        streaming={false}
      />
    </ToolConversation>
  );

  await expect
    .element(screen.getByRole('button', { name: 'foo' }))
    .toBeDisabled();
  await expect
    .element(screen.getByRole('button', { name: 'Approve' }))
    .toBeDisabled();
  await expect
    .element(screen.getByRole('button', { name: 'Deny' }))
    .toBeDisabled();
});

function turn(finished: readonly string[]) {
  return (
    <AssistantMessage
      parts={parts.slice(0, 3)}
      progress={new Map()}
      results={
        new Map(
          finished.map((id) => [id, { output: '', status: 'done' } as const])
        )
      }
      streaming
      working
    />
  );
}

function ticks(container: HTMLElement) {
  return [...container.querySelectorAll('button [data-slot=trace-line]')].map(
    (line) => [line.textContent, line.getAttribute('data-tick')]
  );
}

test('only a step that finishes while the chat is open ticks', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const opened = await renderWithQuery(turn(['a']));

  await expect.poll(() => ticks(opened.screen.container)).toHaveLength(1);

  const before = ticks(opened.screen.container);

  await opened.screen.unmount();

  const watched = await renderWithQuery(turn([]));

  await watched.screen.rerender(turn(['a']));

  await expect.poll(() => ticks(watched.screen.container)).toHaveLength(1);

  expect([...before, ...ticks(watched.screen.container)]).toEqual([
    ['Searched the web for “foo”', null],
    ['Searched the web for “foo”', 'true'],
  ]);
});

test('a turn between steps says it is thinking', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(turn(['a', 'b']));

  await expect
    .element(screen.getByRole('status'))
    .toHaveTextContent('Thinking');
});

test('a turn shows how long it worked as soon as its reply starts', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(
    <AssistantMessage
      parts={parts}
      progress={new Map()}
      results={results}
      span={{ end: 5_000, start: 0 }}
      streaming
      working
    />
  );

  await expect
    .element(
      screen.getByRole('button', {
        name: 'Worked for 5s · 2 actions · 1 failed',
      })
    )
    .toBeVisible();
  await expect.element(screen.getByRole('status')).not.toBeInTheDocument();
});

test('time spent waiting for an answer is not counted as work', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(
    <TooltipProvider>
      <AssistantMessage
        parts={[
          {
            arguments: { options: ['foo', 'bar'], question: 'baz' },
            id: 'a',
            name: 'ask_user',
            type: 'toolCall',
          },
          { text: 'qux', type: 'text' },
        ]}
        progress={new Map()}
        results={
          new Map([
            [
              'a',
              {
                output: 'foo',
                span: { end: 61_000, start: 1_000 },
                status: 'done',
              },
            ],
          ])
        }
        span={{ end: 65_000, start: 0 }}
        streaming={false}
      />
    </TooltipProvider>
  );

  await expect
    .element(screen.getByRole('button', { name: 'Worked for 5s · 1 action' }))
    .toBeVisible();
});

test('unfinished actions settle as stopped once the turn ends', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(
    <AssistantMessage
      parts={parts.slice(0, 3)}
      progress={new Map()}
      results={new Map([['b', { output: '', status: 'stopped' }]])}
      span={{ end: 5_000, start: 0 }}
      streaming={false}
    />
  );

  await screen
    .getByRole('button', { name: 'Worked for 5s · 2 actions · 2 stopped' })
    .click();

  expect(
    [...screen.container.querySelectorAll('[data-slot=trace-line]')].map(
      (line) => [line.getAttribute('data-status'), line.textContent]
    )
  ).toEqual([
    [null, 'Worked for 5s · 2 actions · 2 stopped'],
    ['pending', 'Searching the web for “foo”· Stopped'],
    ['pending', 'Reading a page· Stopped'],
  ]);
});
