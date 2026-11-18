import { renderWithQuery, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { type ToolView, toolRenderer } from './tools';

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

test('a delegate call lists its subagents and opens their reports', async () => {
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
    ['fooDone', 'barFailed', 'bobRunning'],
    ['fooDone', 'barFailed', 'bobStopped'],
  ]);
});
