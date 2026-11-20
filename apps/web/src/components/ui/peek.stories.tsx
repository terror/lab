import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useRef, useState } from 'react';
import { expect, waitFor } from 'storybook/test';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Peek, usePeeking } from './peek';

const meta = preview.meta({
  component: Peek,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'Lab peeking over the top edge of something it is working for, such as an app waiting on lab.ask. Place it inside a relative parent; it sits above that parent’s top edge and reserves no space. Drive shown with usePeeking, which turns true only once the work has lasted 400ms, so a quick answer never flickers, and false 600ms after it ends, so chained work shares one peek; share that value with any status text so both keep time. The thinking mark rises from behind the edge and sinks back. Without rise (Quiet) or under reduced motion it fades in and out in place.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Peek',
});

function Stage({ rise, shown }: { rise?: boolean; shown: boolean }) {
  return (
    <div className='relative mt-6 w-72 max-w-full'>
      <Peek className='right-4' rise={rise} shown={shown} />
      <Card className='h-24' variant='inset' />
    </div>
  );
}

async function peeking({ canvasElement }: { canvasElement: HTMLElement }) {
  await waitFor(
    async () => {
      for (const peek of canvasElement.querySelectorAll('[data-slot=peek]')) {
        await expect(
          peek.querySelector('[data-slot=live-mark]')
        ).not.toBeNull();
      }
    },
    { timeout: 2000 }
  );
}

export const Peeking = meta.story({
  args: { shown: true },
  play: peeking,
  render: ({ shown }) => <Stage shown={shown} />,
});

export const InPlace = meta.story({
  args: { rise: false, shown: true },
  play: peeking,
  render: ({ rise, shown }) => <Stage rise={rise} shown={shown} />,
});

function Asking() {
  const [active, setActive] = useState(false);
  const shown = usePeeking(active);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  return (
    <div className='flex flex-col items-start gap-3'>
      <Button
        onClick={() => {
          setActive(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setActive(false), 2500);
        }}
        size='sm'
        variant='outline'
      >
        Ask for 2.5 seconds
      </Button>
      <Stage shown={shown} />
    </div>
  );
}

export const Toggle = meta.story({
  args: { shown: false },
  render: () => <Asking />,
});
