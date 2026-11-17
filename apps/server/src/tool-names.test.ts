import { extensions } from '@lab/harness';
import { expect, test } from 'bun:test';

import { toolNames } from '../../web/src/components/tools/names';
import { emptyDeps } from '../test/harness';

test('the web app has a preview for every tool the model can call', () => {
  const callable = extensions(emptyDeps())
    .flatMap((extension) => extension.tools ?? [])
    .filter(({ callers }) => callers === undefined || callers.includes('model'))
    .map(({ name }) => name)
    .toSorted();

  expect(callable).toEqual([...toolNames].toSorted());
});
