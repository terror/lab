import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';

import { Composer } from './composer';

class FakeRecognition extends EventTarget {
  static current: FakeRecognition | undefined;

  continuous = false;
  interimResults = false;
  lang = '';
  listening = false;

  constructor() {
    super();
    FakeRecognition.current = this;
  }

  abort() {
    this.stop();
  }

  emit(type: string, fields: object = {}) {
    this.dispatchEvent(Object.assign(new Event(type), fields));
  }

  start() {
    this.listening = true;
  }

  stop() {
    this.listening = false;
    this.emit('end');
  }
}

function Harness() {
  const [draft, setDraft] = useState('foo');

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

async function render(recognition: typeof FakeRecognition | undefined) {
  stubFetch(() => Response.json({ default: null, models: [] }));

  vi.stubGlobal('SpeechRecognition', recognition);
  vi.stubGlobal('webkitSpeechRecognition', undefined);

  return (await renderWithQuery(<Harness />)).screen;
}

test('dictation adds what you say to the draft until you stop it', async () => {
  const screen = await render(FakeRecognition);

  await screen.getByRole('button', { name: 'Dictate' }).click();

  FakeRecognition.current?.emit('result', {
    results: [[{ transcript: 'bar' }], [{ transcript: ' baz' }]],
  });

  await expect
    .element(screen.getByLabelText('Message'))
    .toHaveValue('foo bar baz');

  await screen.getByRole('button', { name: 'Stop dictation' }).click();

  await expect
    .element(screen.getByRole('button', { name: 'Dictate' }))
    .toHaveAttribute('aria-pressed', 'false');

  expect(FakeRecognition.current?.listening).toBe(false);
});

test('dictation explains why it stopped', async () => {
  const screen = await render(FakeRecognition);

  await screen.getByRole('button', { name: 'Dictate' }).click();

  FakeRecognition.current?.emit('error', { error: 'not-allowed' });
  FakeRecognition.current?.emit('end');

  await expect
    .element(screen.getByText('Allow microphone access to dictate'))
    .toBeVisible();
});

test('dictation is hidden where the browser cannot recognize speech', async () => {
  const screen = await render(undefined);

  await expect.element(screen.getByLabelText('Message')).toBeVisible();

  expect(screen.getByRole('button', { name: 'Dictate' }).query()).toBeNull();
});
