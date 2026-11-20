import '@/index.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { preferencesQueryOptions } from '@/lib/preferences';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { Composer } from './composer';

function Draft() {
  const [draft, setDraft] = useState('');

  return (
    <TooltipProvider>
      <Composer
        attachments={[]}
        draft={draft}
        model={undefined}
        onAttachmentsChange={() => undefined}
        onDraftChange={setDraft}
        onModelChange={() => undefined}
        onSubmit={() => undefined}
        tips
      />
    </TooltipProvider>
  );
}

async function idle(hints: string[]) {
  const preferences = { ...defaultPreferences, hints };

  stubFetch((url, init) => {
    if (url.pathname === '/api/capabilities') {
      return Response.json({
        tried: {
          apps: true,
          branches: false,
          helpers: false,
          images: false,
          plan: false,
          schedules: false,
        },
      });
    }

    if (url.pathname === '/api/preferences/hints') {
      const { id } = JSON.parse(
        typeof init?.body === 'string' ? init.body : '{}'
      );

      preferences.hints = [...preferences.hints, id];

      return Response.json({ fresh: true, preferences });
    }

    return Response.json({ default: null, models: [] });
  });

  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, preferences);

  const { screen } = await renderWithQuery(<Draft />, client);

  const message = screen.getByLabelText('Message');

  await message.click();

  return message;
}

test('a composer already used for three tips keeps its placeholder', async () => {
  const message = await idle(['tip:foo', 'tip:bar', 'tip:baz']);

  await new Promise((resolve) => setTimeout(resolve, 5500));

  expect(message.element().getAttribute('aria-description')).toBeNull();
});

test('an idle composer shows one tip a session until a keystroke', async () => {
  const message = await idle([]);

  const tip = () => message.element().getAttribute('aria-description');

  await expect
    .poll(tip, { timeout: 7000 })
    .toBe('Ask Lab to do something every morning');

  await userEvent.keyboard('f');
  await userEvent.keyboard('{Backspace}');

  await new Promise((resolve) => setTimeout(resolve, 5500));

  expect(tip()).toBeNull();
});
