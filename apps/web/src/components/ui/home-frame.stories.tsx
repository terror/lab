import { useState } from 'react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Button } from './button';
import { HomeFrame } from './home-frame';
import { Skeleton } from './skeleton';

const meta = preview.meta({
  component: HomeFrame,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'The frame of the home page. The message box’s top edge sits at --home-anchor: 38% of the panel’s height, and never less than 17rem, which holds the mark, a two-line greeting and a three-line brief. What goes above it grows upward from that line and what goes below hangs from it, so content that arrives late never moves the box you are about to type in. The frame fills its parent, so give that a height.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Home frame',
});

function Frame() {
  const [arrived, setArrived] = useState(false);

  return (
    <div className='flex h-96 w-96 flex-col rounded-card border'>
      <HomeFrame
        above={
          <>
            <p className='text-xl font-semibold'>What are we working on?</p>
            {arrived && (
              <p className='text-sm text-muted-foreground'>
                While you were out, 1 chat finished.
              </p>
            )}
          </>
        }
        below={
          <div className='flex flex-col gap-3 pt-5'>
            {arrived && <Skeleton className='h-11 w-full' />}
            <Button
              className='self-center'
              onClick={() => setArrived(!arrived)}
              size='sm'
              variant='outline'
            >
              {arrived ? 'Clear the news' : 'Let the news arrive'}
            </Button>
          </div>
        }
      >
        <div className='rounded-card border p-4 text-sm text-muted-foreground'>
          Ask anything…
        </div>
      </HomeFrame>
    </div>
  );
}

export const Default = meta.story({ render: () => <Frame /> });
