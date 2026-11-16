import { expect, test } from 'vitest';

import { budgetLevel } from './usage';

function level(limit: number | null, spent: number) {
  return budgetLevel({ limit, spent });
}

test('budget levels', () => {
  expect([level(null, 5), level(10, 7.9), level(10, 8), level(10, 10)]).toEqual(
    [undefined, undefined, 'near', 'over']
  );
});
