import { Button } from '@/components/ui/button';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import { startTransition, useState } from 'react';
import { expect, test } from 'vitest';

import { Markdown } from './markdown';

const replies = Array.from({ length: 60 }, (_, index) => `foo ${index}`);

function Replies() {
  const [shown, setShown] = useState(false);

  return (
    <>
      <Button onClick={() => startTransition(() => setShown(true))}>bar</Button>
      {shown &&
        replies.map((reply) => (
          <Markdown key={reply} streaming={false}>
            {reply}
          </Markdown>
        ))}
    </>
  );
}

test('replies that mount while markdown finishes loading render without a React error', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  await import('./markdown-renderer');

  const errors = new Array<string>();

  const onError = (event: ErrorEvent) => {
    errors.push(event.message);
  };

  window.addEventListener('error', onError);

  const { screen } = await renderWithQuery(<Replies />);

  await screen.getByRole('button', { name: 'bar' }).click();

  await expect.element(screen.getByText('foo 59')).toBeVisible();

  window.removeEventListener('error', onError);

  expect(errors).toEqual([]);
});
