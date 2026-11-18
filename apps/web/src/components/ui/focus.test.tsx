import '@/index.css';
import { watchModality } from '@/lib/modality';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { Button } from './button';
import { Input } from './input';

function outline() {
  return getComputedStyle(document.activeElement ?? document.body);
}

test('Tab draws the focus ring and a click never does', async () => {
  const stop = watchModality();

  const screen = await render(
    <>
      <Button>foo</Button>
      <Input aria-label='bar' />
    </>
  );

  const seen = new Array<string>();

  await screen.getByRole('textbox').click();

  seen.push(outline().outlineStyle);

  await userEvent.tab({ shift: true });

  seen.push(outline().outlineStyle);

  const { outlineColor, outlineOffset, outlineWidth } = outline();

  await userEvent.tab();

  seen.push(outline().outlineStyle);

  await screen.getByRole('textbox').click();

  seen.push(outline().outlineStyle);

  stop();

  expect({
    ring: { color: outlineColor, offset: outlineOffset, width: outlineWidth },
    seen,
  }).toEqual({
    ring: { color: 'oklch(0.145 0 0)', offset: '2px', width: '2px' },
    seen: ['none', 'solid', 'solid', 'none'],
  });
});
