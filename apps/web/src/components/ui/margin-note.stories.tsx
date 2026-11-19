import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { useState } from 'react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { MarginNote } from './margin-note';

const meta = preview.meta({
  component: MarginNote,
  decorators: [themes],
  tags: ['autodocs'],
  title: 'Components/MarginNote',
});

export const Shown = meta.story({
  render: () => (
    <MarginNote className='w-80'>I’ll tick these off as I go.</MarginNote>
  ),
});

export const WithKeys = meta.story({
  render: () => (
    <MarginNote className='w-80'>
      Type <Kbd>/compact</Kbd> to tidy the older turns.
    </MarginNote>
  ),
});

function Toggle() {
  const [shown, setShown] = useState(true);

  return (
    <div className='flex w-80 flex-col items-start gap-3'>
      <Button onClick={() => setShown(!shown)} size='sm' variant='outline'>
        {shown ? 'Retire' : 'Show'}
      </Button>
      <MarginNote>{shown && 'Your first answer is still here.'}</MarginNote>
    </div>
  );
}

export const Arriving = meta.story({ render: () => <Toggle /> });
