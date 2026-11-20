import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

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
    this.listening = false;
    this.emit('end');
  }

  emit(type: string, fields: object = {}) {
    this.dispatchEvent(Object.assign(new Event(type), fields));
  }

  start() {
    this.listening = true;
  }

  stop() {
    this.listening = false;

    setTimeout(() => {
      this.emit('result', { results: [[{ transcript: 'bar' }]] });
      this.emit('end');
    });
  }
}

function Harness({ initial, running }: { initial: string; running: boolean }) {
  const [draft, setDraft] = useState(initial);

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
        running={running}
      />
    </TooltipProvider>
  );
}

async function render(
  recognition: typeof FakeRecognition | undefined,
  { initial = 'foo', running = false } = {}
) {
  stubFetch(() => Response.json({ default: null, models: [] }));

  vi.stubGlobal('SpeechRecognition', recognition);
  vi.stubGlobal('webkitSpeechRecognition', undefined);

  return (
    await renderWithQuery(<Harness initial={initial} running={running} />)
  ).screen;
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
    .element(
      screen.getByText('Couldn’t use the microphone. Allow access to dictate.')
    )
    .toBeVisible();
});

test('dictation is hidden where the browser cannot recognize speech', async () => {
  const screen = await render(undefined);

  await expect.element(screen.getByLabelText('Message')).toBeVisible();

  expect(screen.getByRole('button', { name: 'Dictate' }).query()).toBeNull();
});

test('typing while dictating keeps what you type', async () => {
  const screen = await render(FakeRecognition);

  await screen.getByRole('button', { name: 'Dictate' }).click();

  FakeRecognition.current?.emit('result', {
    results: [[{ transcript: 'bar' }]],
  });

  await screen.getByLabelText('Message').click();
  await userEvent.keyboard('{End}x');

  await expect
    .element(screen.getByLabelText('Message'))
    .toHaveValue('foo barx');
});

test('during a run the mic stays until dictation stops, then hands focus to the message', async () => {
  const screen = await render(FakeRecognition, { initial: '', running: true });

  await screen.getByRole('button', { name: 'Dictate' }).click();

  FakeRecognition.current?.emit('result', {
    results: [[{ transcript: 'foo' }]],
  });

  await screen.getByRole('button', { name: 'Stop dictation' }).click();

  await expect
    .poll(() => document.activeElement)
    .toBe(screen.getByLabelText('Message').element());

  expect(screen.getByRole('button', { name: 'Dictate' }).query()).toBeNull();
});
