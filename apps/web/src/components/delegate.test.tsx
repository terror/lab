import { renderWithQuery, stubFetch } from '@/test/helpers';
import { expect, test, vi } from 'vitest';

import { type ToolView, toolRenderer } from './tools';
import { OpenSubagent } from './tools/delegate';

const view = {
  args: {},
  callId: 'qux',
  details: {
    subagents: [
      { status: 'done', summary: 'baz', title: 'foo' },
      { status: 'failed', summary: 'qux', title: 'bar' },
      { status: 'running', title: 'bob' },
    ],
  },
  history: [],
  output: '',
};

async function rows(active: boolean) {
  const { screen } = await renderWithQuery(
    toolRenderer('delegate').inline?.({ ...view, active } satisfies ToolView)
  );

  const states = screen
    .getByRole('listitem')
    .elements()
    .map((row) => row.textContent);

  return { screen, states };
}

test('a delegate call lists its subagents, shows why one failed and opens their reports', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const working = await rows(true);

  await working.screen.unmount();

  const stopped = await rows(false);

  await stopped.screen.getByRole('button', { name: /foo/ }).click();

  await expect.element(stopped.screen.getByText('baz')).toBeVisible();

  expect([working.states, stopped.states]).toEqual([
    ['fooDone', 'barFailedqux', 'bobRunning'],
    ['fooDone', 'barFailedqux', 'bobStopped'],
  ]);
});

function lanes(status: 'done' | 'failed' | 'running') {
  return toolRenderer('delegate').inline?.({
    ...view,
    active: true,
    details: {
      subagents: [
        { status: 'done', title: 'foo' },
        { status, title: 'bar' },
      ],
    },
  } satisfies ToolView);
}

test('a delegate call folds its lanes once every subagent is done', async () => {
  const { screen } = await renderWithQuery(lanes('running'));

  await screen.rerender(lanes('done'));

  await expect.element(screen.getByRole('list')).not.toBeInTheDocument();

  await screen.getByRole('button', { name: /2 subagents/ }).click();

  await expect
    .element(screen.getByRole('list'))
    .toHaveTextContent('fooDonebarDone');
});

async function expanded(status: 'done' | 'failed') {
  const { screen } = await renderWithQuery(lanes('running'));

  await screen.rerender(lanes(status));

  vi.advanceTimersByTime(700);

  await screen.rerender(lanes(status));

  const state = screen
    .getByRole('button', { name: /2 subagents/ })
    .element()
    .getAttribute('aria-expanded');

  await screen.unmount();

  return state;
}

test('a delegate call stays open when a subagent failed', async ({
  onTestFinished,
}) => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

  onTestFinished(() => {
    vi.useRealTimers();
  });

  expect([await expanded('done'), await expanded('failed')]).toEqual([
    'false',
    'true',
  ]);
});

async function header(status: 'done' | 'failed' | 'running') {
  const { screen } = await renderWithQuery(lanes(status));

  const text = screen
    .getByRole('button', { name: /2 subagents/ })
    .element().textContent;

  await screen.unmount();

  return text;
}

test('a delegate call counts the subagents that are done and the ones that failed', async () => {
  expect([
    await header('running'),
    await header('done'),
    await header('failed'),
  ]).toEqual([
    '2 subagents1 of 2 done',
    '2 subagents2 of 2 done',
    '2 subagents1 of 2 done · 1 failed',
  ]);
});

test('a delegate lane opens its subagent and marks the one that is open', async () => {
  const open = vi.fn();

  const { screen } = await renderWithQuery(
    <OpenSubagent value={{ open, shown: 2 }}>
      {toolRenderer('delegate').inline?.({
        ...view,
        active: true,
        details: {
          subagents: [
            { id: 1, status: 'done', summary: 'baz', title: 'foo' },
            { id: 2, status: 'failed', summary: 'qux', title: 'bar' },
          ],
        },
      } satisfies ToolView)}
    </OpenSubagent>
  );

  await screen.getByRole('button', { name: /^foo/ }).click();

  expect({
    current: screen
      .getByRole('button', { name: /^(foo|bar)/ })
      .elements()
      .map((lane) => lane.getAttribute('aria-current')),
    opened: open.mock.calls,
    rows: screen
      .getByRole('listitem')
      .elements()
      .map((row) => row.textContent),
  }).toEqual({
    current: [null, 'true'],
    opened: [[1]],
    rows: ['fooDone', 'barFailedqux'],
  });
});
