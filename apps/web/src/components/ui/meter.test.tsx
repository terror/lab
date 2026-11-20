import { renderWithQuery } from '@/test/helpers';
import { expect, test } from 'vitest';

import { Meter, surface } from './meter';

test('the flask fills by area, so half spent sits below half height', () => {
  expect([0, 0.25, 0.5, 1, 2].map(surface)).toEqual([
    29, 24.76923076923077, 21.22222222222222, 5, 5,
  ]);
});

async function read(label: string, value: number, valueText?: string) {
  const { screen } = await renderWithQuery(
    <Meter label={label} value={value} valueText={valueText} variant='flask' />
  );

  const meter = screen.getByRole('meter', { name: label }).element();

  return [
    meter.getAttribute('aria-valuenow'),
    meter.getAttribute('aria-valuetext'),
  ];
}

test('a meter reads a share it can measure and any words it is given', async () => {
  expect([
    await read('foo', 0.5),
    await read('bar', Number.NaN),
    await read('baz', 1.1, 'qux'),
  ]).toEqual([
    ['50', null],
    ['0', null],
    ['100', 'qux'],
  ]);
});
