import { random } from './seed';

export const SIDE = 5;

const CENTRE = 12;

function twin(cell: number) {
  return cell - (cell % SIDE) + (SIDE - 1 - (cell % SIDE));
}

function shuffled<T>(items: readonly T[], next: () => number) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(next() * (index + 1));

    [result[index], result[other]] = [result[other]!, result[index]!];
  }

  return result;
}

export function sigil(seed: string) {
  const next = random(seed);

  const pairs = Array.from({ length: SIDE * SIDE }, (_, cell) => cell)
    .filter((cell) => cell !== CENTRE && cell <= twin(cell))
    .map((cell) => [...new Set([cell, twin(cell)])]);

  const target = 10 + Math.floor(next() * 7);

  const lit = [[CENTRE]];

  for (const pair of shuffled(pairs, next)) {
    if (lit.flat().length >= target) {
      break;
    }

    lit.push(pair);
  }

  return lit;
}
