import { Toaster } from '@/components/ui/sonner';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { BudgetPanel } from './budget';

test('a removed budget comes back with Undo', async () => {
  const fetch = stubFetch((_, init) =>
    Response.json({
      limit: typeof init?.body === 'string' ? JSON.parse(init.body).limit : 25,
      spent: 0,
    })
  );

  const { screen } = await renderWithQuery(
    <>
      <BudgetPanel />
      <Toaster />
    </>
  );

  await screen.getByRole('button', { name: 'Remove' }).click();
  await screen.getByRole('button', { name: 'Undo' }).click();

  await expect
    .element(
      screen.getByRole('spinbutton', { name: 'Monthly budget in US dollars' })
    )
    .toHaveValue(25);

  expect(
    fetch.mock.calls.flatMap(([, init]) =>
      init?.method === 'PUT' ? [init.body] : []
    )
  ).toEqual([JSON.stringify({ limit: null }), JSON.stringify({ limit: 25 })]);
});
