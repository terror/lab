import { useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './dialog';

function Opener() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>foo</Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogTitle>bar</DialogTitle>
          <DialogDescription>baz</DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  );
}

test('a dialog opened without a trigger gives focus back when it closes', async () => {
  const screen = await render(<Opener />);

  await screen.getByRole('button', { name: 'foo' }).click();

  await expect.element(screen.getByRole('dialog')).toBeVisible();

  await userEvent.keyboard('{Escape}');

  await expect
    .element(screen.getByRole('button', { name: 'foo' }))
    .toHaveFocus();
});
