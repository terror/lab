import { expect, test } from 'vitest';

import { SIDE, sigil } from './sigil';

function rows(lit: readonly number[]) {
  return Array.from({ length: SIDE }, (_row, row) =>
    Array.from({ length: SIDE }, (_column, column) =>
      lit.includes(row * SIDE + column) ? '#' : '.'
    ).join('')
  );
}

test('a seed always draws the same grid in the same order', () => {
  expect({
    bar: rows(sigil('bar').flat()),
    baz: rows(sigil('baz').flat()),
    foo: rows(sigil('foo').flat()),
    order: sigil('foo'),
  }).toEqual({
    bar: ['#.#.#', '.#.#.', '#####', '#...#', '.#.#.'],
    baz: ['.#.#.', '##.##', '.###.', '..#..', '.###.'],
    foo: ['.....', '#.#.#', '#.#.#', '#####', '#####'],
    order: [
      [12],
      [20, 24],
      [15, 19],
      [16, 18],
      [7],
      [5, 9],
      [22],
      [21, 23],
      [17],
      [10, 14],
    ],
  });
});

test('every sigil is mirrored, lights its centre and has 10 to 17 cells', () => {
  const broken = Array.from({ length: 2_000 }, (_, index) => `foo${index}`)
    .map((seed) => ({ lit: sigil(seed).flat(), seed }))
    .filter(({ lit }) => {
      const mirrored = rows(lit).every(
        (row) => row === row.split('').toReversed().join('')
      );

      return (
        !mirrored ||
        lit[0] !== 12 ||
        lit.length < 10 ||
        lit.length > 17 ||
        new Set(lit).size !== lit.length
      );
    });

  expect(broken).toEqual([]);
});
