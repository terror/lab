import { useState } from 'react';
import { fn } from 'storybook/test';

import preview from '../../.storybook/preview';
import type { Attachment } from '../lib/attachments';
import { Composer } from './composer';

function Harness({
  initial = '',
  running = false,
}: {
  initial?: string;
  running?: boolean;
}) {
  const [draft, setDraft] = useState(initial);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  return (
    <div className='w-3xl max-w-full'>
      <Composer
        attachments={attachments}
        draft={draft}
        model={{
          id: 'claude-sonnet-5.5',
          provider: 'anthropic',
          thinkingLevel: 'medium',
        }}
        onAttachmentsChange={setAttachments}
        onDraftChange={setDraft}
        onModelChange={fn()}
        onSteer={fn()}
        onStop={fn()}
        onSubmit={fn()}
        running={running}
      />
    </div>
  );
}

const meta = preview.meta({
  component: Composer,
  tags: ['autodocs'],
  title: 'Patterns/Composer',
});

export const Empty = meta.story({ render: () => <Harness /> });

export const Drafting = meta.story({
  render: () => <Harness initial='Plan a three day trip to Kyoto' />,
});

export const Running = meta.story({ render: () => <Harness running /> });

export const Steering = meta.story({
  render: () => <Harness initial='Focus on temples' running />,
});
