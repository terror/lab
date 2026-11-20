import { ToolConversation } from '@/components/tools';
import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import { expect, test, vi } from 'vitest';
import '@/index.css';

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

  const fold = screen.getByRole('button', { name: '2 steps' });

  await expect.element(fold).toHaveAttribute('aria-expanded', 'false');
  await expect.element(screen.getByText('Worked for 2m 31s')).toBeVisible();
  await expect
    .element(screen.getByRole('button', { name: '1 failed' }))
    .toBeVisible();
  await expect.element(screen.getByText('bar')).toBeVisible();
  await expect.element(screen.getByText('baz')).toBeVisible();
  await expect
    .element(screen.getByText('Couldn’t read a page'))
    .not.toBeInTheDocument();

  await fold.click();

  await expect.element(screen.getByText('Couldn’t read a page')).toBeVisible();
});

test('a running turn says what it is doing on one line and keeps its steps folded', async () => {
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

  await expect.element(screen.getByText('Reading a page')).toBeVisible();
  await expect.element(screen.getByRole('status')).toHaveTextContent('Working');
  await expect.element(screen.getByText('bar')).toBeVisible();

  expect(
    screen.container.querySelectorAll('[data-slot=trace-line]')
  ).toHaveLength(0);
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

function verb(container: HTMLElement) {
  const shown = container.querySelector('[data-slot=run-line-verb]');

  return [shown?.textContent, shown?.getAttribute('data-tick')];
}

test('the verb flips to the past tense, ticked, when its step settles while the chat is open', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const opened = await renderWithQuery(turn(['a']));

  const before = verb(opened.screen.container);

  await opened.screen.unmount();

  const watched = await renderWithQuery(turn([]));

  await watched.screen.rerender(turn(['a']));

  await expect
    .poll(() => verb(watched.screen.container))
    .toEqual(['Searched the web for “foo”', 'true']);

  await expect
    .poll(() => verb(watched.screen.container))
    .toEqual(['Reading a page', null]);

  expect(before).toEqual(['Reading a page', null]);
});

test('a turn between steps says it is thinking', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(turn(['a', 'b']));

  await expect.element(screen.getByText('Thinking').first()).toBeVisible();
  await expect
    .element(screen.getByRole('status'))
    .toHaveTextContent('Thinking');
});

test('a turn that is writing its reply says so on the same line', async () => {
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

  await expect.element(screen.getByRole('status')).toHaveTextContent('Writing');

  expect(
    screen.container.querySelector('[data-slot=run-line-verb]')?.textContent
  ).toBe('Writing');
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
          parts[0],
          { text: 'qux', type: 'text' },
        ]}
        progress={new Map()}
        results={
          new Map<string, ToolResult>([
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

  await expect.element(screen.getByText('Worked for 5s')).toBeVisible();
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

  await expect
    .element(screen.getByRole('button', { name: '2 stopped' }))
    .toBeVisible();

  await screen.getByRole('button', { name: '2 steps' }).click();

  expect(
    [...screen.container.querySelectorAll('[data-slot=trace-line]')].map(
      (line) => [line.getAttribute('data-status'), line.textContent]
    )
  ).toEqual([
    ['pending', 'Searching the web for “foo”· Stopped'],
    ['pending', 'Reading a page· Stopped'],
  ]);
});

function reply(working: boolean, hop?: 'proud') {
  return (
    <TooltipProvider>
      <AssistantMessage
        hop={hop}
        latest={!working}
        parts={parts}
        progress={new Map()}
        results={results}
        span={{ end: 151_000, start: 0 }}
        streaming={working}
        working={working}
      />
    </TooltipProvider>
  );
}

test('a finished turn’s mark plays the hop it is handed and otherwise rests', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(reply(false));

  const mark = () =>
    screen.container
      .querySelector('[data-slot=live-mark]')
      ?.getAttribute('data-state');

  const rest = mark();

  await screen.rerender(reply(false, 'proud'));

  expect([rest, mark()]).toEqual(['idle', 'proud']);
});

function approval(decision?: 'approved') {
  return (
    <AssistantMessage
      parts={[
        { arguments: {}, id: 'a', name: 'trash_purge', type: 'toolCall' },
      ]}
      progress={
        new Map([
          [
            'a',
            {
              details: { approval: { action: 'foo', decision, summary: [] } },
              output: '',
              status: 'running',
            },
          ],
        ])
      }
      results={new Map()}
      streaming
      working
    />
  );
}

test('a pending approval clears its throat once, then swallows the answer', async ({
  onTestFinished,
}) => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

  onTestFinished(() => {
    vi.useRealTimers();
  });

  const { screen } = await renderWithQuery(approval());

  const mark = () =>
    screen.container
      .querySelector('[data-slot=live-mark]')
      ?.getAttribute('data-state');

  const seen = [mark()];

  vi.advanceTimersByTime(8_000);

  await screen.rerender(approval());

  seen.push(mark());

  await screen.rerender(approval('approved'));

  seen.push(mark());

  vi.advanceTimersByTime(640);

  await screen.rerender(approval('approved'));

  seen.push(mark());

  expect(seen).toEqual(['waiting', 'ahem', 'gulp', 'thinking']);
});

const attempts = {
  failed: { failure: 'model_error', retrying: false },
  retrying: { failure: 'model_error', retrying: true },
} as const;

function attempt(state: keyof typeof attempts, slip = false) {
  return (
    <TooltipProvider>
      <AssistantMessage
        {...attempts[state]}
        latest
        parts={parts}
        progress={new Map()}
        results={results}
        slip={slip}
        span={{ end: 5_000, start: 0 }}
        streaming={false}
      />
    </TooltipProvider>
  );
}

function failureMark() {
  return document
    .querySelector('[role=alert] [data-slot=live-mark]')
    ?.getAttribute('data-state');
}

test('a failed reply slips when told to, mends on Retry, and holds still if the retry never starts', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(attempt('failed'));

  const seen = [failureMark()];

  for (const state of ['failed', 'retrying', 'failed'] as const) {
    await screen.rerender(attempt(state, true));

    seen.push(failureMark());
  }

  expect(seen).toEqual(['broken', 'error', 'recover', 'broken']);
});

async function spin(failure: 'aborted' | 'model_error') {
  stubFetch(() => Response.json({ default: null, models: [] }));

  const { screen } = await renderWithQuery(
    <TooltipProvider>
      <AssistantMessage
        failure={failure}
        latest
        onRetry={() => undefined}
        parts={[{ text: 'foo', type: 'text' }]}
        progress={new Map()}
        results={new Map()}
        streaming={false}
      />
    </TooltipProvider>
  );

  const retry = screen.getByRole('button', { name: 'Retry' });

  await retry.click();

  const icon = retry.element().querySelector('svg');

  const name = icon && getComputedStyle(icon).animationName;

  await screen.unmount();

  return name;
}

test('Retry spins on a stopped reply but leaves a failed one to its mended mark', async () => {
  expect([await spin('aborted'), await spin('model_error')]).toEqual([
    'retry',
    'none',
  ]);
});

function thinkingSince(at: number) {
  return (
    <AssistantMessage
      clock={{ at, linked: true, start: 100_000, waited: 0 }}
      parts={parts.slice(0, 1)}
      progress={new Map()}
      results={new Map([['a', { output: '', status: 'done' }]])}
      streaming={false}
      working
    />
  );
}

test('a run’s line starts as the mark alone, then counts, sums up, stalls and says it can be left', async ({
  onTestFinished,
}) => {
  vi.useFakeTimers({ toFake: ['Date', 'clearTimeout', 'setTimeout'] });
  vi.setSystemTime(100_000);

  onTestFinished(() => {
    vi.useRealTimers();
  });

  const { screen } = await renderWithQuery(thinkingSince(100_000));

  const shown = () => {
    const line = screen.container.querySelector('[data-slot=run-line]');

    return [
      line?.querySelector('[data-slot=live-mark]')?.getAttribute('data-state'),
      line?.getAttribute('data-stalled'),
      line?.querySelector('[data-slot=run-line-row]')?.textContent,
    ];
  };

  const seen = [shown()];

  for (const [wait, at] of [
    [2_000, 100_000],
    [8_000, 110_000],
    [20_000, 110_000],
    [30_000, 110_000],
    [0, 160_000],
  ] as const) {
    vi.advanceTimersByTime(wait);

    await screen.rerender(thinkingSince(at));

    seen.push(shown());
  }

  expect(seen).toEqual([
    ['pondering', null, 'Thinking'],
    ['pondering', null, 'ThinkingThinking'],
    ['pondering', null, 'Thinking·10s·1 step·searched onceThinking'],
    [
      'pondering',
      'true',
      'Thinking·30s·1 step·still on it, the model is slow right nowThinking',
    ],
    [
      'pondering',
      'true',
      'Thinking·1m 0s·1 step·You can leave this·still on it, the model is slow right nowThinking',
    ],
    ['pondering', null, 'Thinking·1m 0s·1 step·You can leave thisThinking'],
  ]);
});

test('a finished turn’s steps say how long they took and where the model thought or stalled', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(
    <TooltipProvider>
      <AssistantMessage
        parts={[{ thinking: 'foo', type: 'thinking' }, ...parts]}
        progress={new Map()}
        results={
          new Map<string, ToolResult>([
            [
              'a',
              {
                output: '',
                span: { end: 6_000, start: 4_000 },
                status: 'done',
              },
            ],
            ['b', { output: '', status: 'done' }],
          ])
        }
        rounds={[
          { at: 0, parts: 2, span: { end: 4_000, start: 0 } },
          { at: 2, parts: 3, span: { end: 16_000, start: 15_000 } },
        ]}
        span={{ end: 16_000, start: 0 }}
        streaming={false}
      />
    </TooltipProvider>
  );

  await screen.getByRole('button', { name: '2 steps' }).click();

  expect(
    [...screen.container.querySelectorAll('[data-slot=trace-line]')].map(
      (row) => row.textContent
    )
  ).toEqual([
    'Thought· 4s',
    'Searched the web for “foo”· 2s',
    'Waited on the model· 9s',
    'Read a page',
  ]);
});

test('a short one-step turn’s receipt is the step itself', async () => {
  const { screen } = await renderWithQuery(
    <TooltipProvider>
      <AssistantMessage
        parts={parts.slice(0, 2)}
        progress={new Map()}
        results={
          new Map([
            ['a', { details: { count: 3 }, output: 'baz', status: 'done' }],
          ])
        }
        span={{ end: 2_000, start: 0 }}
        streaming={false}
      />
    </TooltipProvider>
  );

  const line = screen.container.querySelector('[data-slot=run-line-row]');

  await screen
    .getByRole('button', { name: 'Searched the web for “foo”' })
    .click();

  await expect.element(screen.getByText('baz')).toBeVisible();

  expect(line?.textContent).toBe('Searched the web for “foo”·3 results');
});

test('a receipt links to what the turn read and made, and washes the result it made', async () => {
  const { screen } = await renderWithQuery(
    <TooltipProvider>
      <AssistantMessage
        parts={[
          parts[2],
          {
            arguments: { prompt: 'foo' },
            id: 'c',
            name: 'image_generate',
            type: 'toolCall',
          },
          { text: 'bar', type: 'text' },
        ]}
        progress={new Map()}
        results={
          new Map<string, ToolResult>([
            ['b', { output: '', status: 'done' }],
            [
              'c',
              {
                details: { name: 'foo.png', uploadId: 'baz' },
                output: '',
                status: 'done',
              },
            ],
          ])
        }
        span={{ end: 20_000, start: 0 }}
        streaming={false}
      />
    </TooltipProvider>
  );

  await screen.getByRole('button', { name: '1 file' }).click();

  const made = screen.container.querySelector('#result-c');

  expect({
    focused: document.activeElement === made,
    line: screen.container.querySelector('[data-slot=run-line-row]')
      ?.textContent,
    located: made?.hasAttribute('data-located'),
    open: screen
      .getByRole('button', { name: '2 steps' })
      .element()
      .getAttribute('aria-expanded'),
  }).toEqual({
    focused: true,
    line: 'Worked for 20s·2 steps·1 source·1 file',
    located: true,
    open: 'false',
  });

  await screen.getByRole('button', { name: '1 source' }).click();

  await expect
    .element(screen.getByRole('button', { name: '2 steps' }))
    .toHaveAttribute('aria-expanded', 'true');
});

test('a model backing off shows on the line with its countdown and reason', async ({
  onTestFinished,
}) => {
  vi.useFakeTimers({ toFake: ['Date', 'clearTimeout', 'setTimeout'] });
  vi.setSystemTime(100_000);

  onTestFinished(() => {
    vi.useRealTimers();
  });

  const { screen } = await renderWithQuery(
    <AssistantMessage
      backoff={{ at: 104_000, error: 'foo' }}
      clock={{ at: 100_000, linked: true, start: 100_000, waited: 0 }}
      parts={[]}
      progress={new Map()}
      results={new Map()}
      streaming={false}
      working
    />
  );

  expect(
    screen.container.querySelector('[data-slot=run-line-row]')?.textContent
  ).toBe('Retrying·in 4s·fooRetrying');
});

function writing(activity: string) {
  return (
    <AssistantMessage
      activity={activity}
      clock={{ at: Date.now(), linked: true, start: 0, waited: 0 }}
      parts={[]}
      progress={new Map()}
      results={new Map()}
      streaming={false}
      working
    />
  );
}

test('the seconds follow a new verb at once instead of waiting behind the old one', async () => {
  const { screen } = await renderWithQuery(writing('foo foo foo foo foo foo'));

  await screen.rerender(writing('bar'));

  const gap = () => {
    const shown = [
      ...screen.container.querySelectorAll('[data-slot=run-line-verb]'),
    ].find((line) => line.textContent === 'bar');

    const dot = shown?.parentElement?.nextElementSibling;

    return (
      shown &&
      dot &&
      Math.round(
        dot.getBoundingClientRect().left - shown.getBoundingClientRect().right
      )
    );
  };

  await expect.poll(gap).toBe(4);
});

test('a stopped reply says what it keeps', async () => {
  stubFetch(() => Response.json({ default: null, models: [] }));

  const { screen } = await renderWithQuery(
    <TooltipProvider>
      <AssistantMessage
        failure='aborted'
        latest
        parts={parts}
        progress={new Map()}
        results={results}
        span={{ end: 19_000, start: 0 }}
        streaming={false}
      />
    </TooltipProvider>
  );

  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent(
      'Stopped · 1 finished step and the partial answer are kept'
    );
});
