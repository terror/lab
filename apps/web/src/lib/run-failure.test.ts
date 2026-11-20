import { expect, test } from 'vitest';

import { runEnding } from './run-failure';

test('a run that ends early says what it keeps', () => {
  expect([
    runEnding('aborted', { steps: 5, wrote: true }),
    runEnding('aborted', { steps: 1, wrote: false }),
    runEnding('aborted', { steps: 0, wrote: true }),
    runEnding('model_error', { steps: 2, wrote: false }),
    runEnding('model_error', { steps: 0, wrote: false }),
  ]).toEqual([
    {
      kept: '5 finished steps and the partial answer are kept',
      title: 'Stopped',
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
