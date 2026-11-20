import '@/index.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useNote } from '@/lib/hints';
import { preferencesQueryOptions } from '@/lib/preferences';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { Composer } from './composer';

function Planned() {
  const [draft, setDraft] = useState('');

  useNote('plan', true);

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
      />
    </TooltipProvider>
  );
}

test('a margin note sits under the composer until a keystroke', async () => {
  const preferences = { ...defaultPreferences, hints: ['foo'] };

  stubFetch((url) =>
    url.pathname === '/api/preferences/hints'
      ? Response.json({
          fresh: true,
          preferences: { ...preferences, hints: ['foo', 'plan'] },
        })
      : Response.json({ default: null, models: [] })
  );

  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, preferences);

  const { screen } = await renderWithQuery(<Planned />, client);

  const note = () =>
    screen.container.querySelector('[data-slot=margin-note]')?.textContent;

  await expect.poll(note).toBe('I’ll tick these off as I go.');

  await screen.getByLabelText('Message').click();
  await userEvent.keyboard('f');

  await expect.poll(note).toBe('');
});
