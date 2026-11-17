import { TooltipProvider } from '@/components/ui/tooltip';
import { queryClient } from '@/lib/query-client';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import { useState } from 'react';
import { toast } from 'sonner';
import { expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { Composer } from './composer';
import { QuestionCard } from './question-card';
import { Skills } from './skills';

const skill = {
  createdAt: 0,
  description: 'bar',
  id: 'qux',
  instructions: 'baz',
  name: 'foo',
  updatedAt: 0,
};

test('audit: failed skill delete is silent', async () => {
  const error = vi.spyOn(toast, 'error');

  stubFetch((_, init) =>
    init?.method === 'DELETE'
      ? Response.json({ error: 'boom' }, { status: 500 })
      : Response.json({ skills: [skill] })
  );

  const { screen } = await renderWithQuery(<Skills />, queryClient);

  await screen.getByRole('button', { name: 'Delete foo' }).click();

  await new Promise((resolve) => setTimeout(resolve, 300));

  expect({
    alerts: screen.getByRole('alert').elements().length,
    toasts: error.mock.calls.length,
  }).toEqual('x');
});

test('audit: question card error shown twice', async () => {
  const error = vi.spyOn(toast, 'error');

  stubFetch(() => Response.json({ error: 'boom' }, { status: 500 }));

  const { screen } = await renderWithQuery(
    <QuestionCard
      answer={undefined}
      callId='foo'
      conversationId={1}
      options={['bar']}
      question='baz'
    />,
    queryClient
  );

  await screen.getByRole('button', { name: 'bar' }).click();

  await expect.element(screen.getByRole('alert')).toHaveTextContent('boom');

  expect({ toasts: error.mock.calls }).toEqual('x');
});

class FakeRecognition extends EventTarget {
  static current: FakeRecognition | undefined;

  continuous = false;
  interimResults = false;
  lang = '';

  constructor() {
    super();
    FakeRecognition.current = this;
  }

  abort() {
    this.dispatchEvent(new Event('end'));
  }

  start() {}

  stop() {
    queueMicrotask(() => {
      this.dispatchEvent(
        Object.assign(new Event('result'), {
          results: [[{ transcript: 'bar' }]],
        })
      );
      this.dispatchEvent(new Event('end'));
    });
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

test('audit: typing during dictation is overwritten by final result', async () => {
  stubFetch(() => Response.json({ default: null, models: [] }));

  vi.stubGlobal('SpeechRecognition', FakeRecognition);
  vi.stubGlobal('webkitSpeechRecognition', undefined);

  const { screen } = await renderWithQuery(<Harness />);

  await screen.getByRole('button', { name: 'Dictate' }).click();

  FakeRecognition.current?.dispatchEvent(
    Object.assign(new Event('result'), { results: [[{ transcript: 'bar' }]] })
  );

  await expect.element(screen.getByLabelText('Message')).toHaveValue('foo bar');

  await screen.getByLabelText('Message').click();
  await userEvent.keyboard('{End}x');

  await new Promise((resolve) => setTimeout(resolve, 100));

  expect({
    value: (screen.getByLabelText('Message').element() as HTMLTextAreaElement)
      .value,
  }).toEqual('x');
});
