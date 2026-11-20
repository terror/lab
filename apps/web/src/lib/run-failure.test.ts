import { expect, test } from 'vitest';

import { runEnding } from './run-failure';

test('a run that ends early says when it stopped and what it keeps', () => {
  expect([
    runEnding('aborted', { at: 19_000, steps: 5, wrote: true }),
    runEnding('aborted', { at: 400, steps: 1, wrote: false }),
    runEnding('aborted', { steps: 0, wrote: true }),
    runEnding('model_error', { at: 19_000, steps: 2, wrote: false }),
    runEnding('model_error', { steps: 0, wrote: false }),
  ]).toEqual([
    {
      kept: '5 finished steps and the partial answer are kept',
      title: 'Stopped at 19s',
    },
    { kept: '1 finished step is kept', title: 'Stopped' },
    { kept: 'the partial answer is kept', title: 'Stopped' },
    {
      kept: '2 finished steps are kept',
      title: 'Couldn’t get an answer from the model',
    },
    { kept: undefined, title: 'Couldn’t get an answer from the model' },
  ]);
});
