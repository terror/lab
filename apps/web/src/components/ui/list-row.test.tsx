import '@/index.css';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { cdp, userEvent } from 'vitest/browser';

import { ListRow } from './list-row';

function opacities() {
  return ['status', 'actions'].map(
    (part) =>
      getComputedStyle(
        document.querySelector(`[data-slot=list-row-${part}]`) ?? document.body
      ).opacity
  );
}

async function renderRow() {
  return render(
    <ul>
      <ListRow
        actions={<button type='button'>foo</button>}
        size='compact'
        status='bar'
      >
        baz
      </ListRow>
    </ul>
  );
}

test('a row status gives way to its actions on hover', async () => {
  const screen = await renderRow();

  const seen = [opacities()];

  await userEvent.hover(screen.getByText('baz'));

  await expect.poll(opacities).toEqual(['0', '1']);

  expect(seen).toEqual([['1', '0']]);
});

test('a row status sits beside its actions on a touch screen', async ({
  onTestFinished,
}) => {
  await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: true });

  onTestFinished(async () => {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: false });
  });

  await renderRow();

  expect(opacities()).toEqual(['1', '1']);
});
