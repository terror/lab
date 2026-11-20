import { Button } from '@/components/ui/button';
import { useState } from 'react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { StatusNote } from './status-note';

const meta = preview.meta({
  component: StatusNote,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'One muted status beside a title, such as “Asking Lab” or “Saved” on an app. It is a polite live region that stays mounted, so a screen reader hears each new status once, and it takes no width while empty. A new status fades in at --motion-fast after the old one fades out; it never moves.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/StatusNote',
});

function Header({ status }: { status?: string }) {
  return (
    <div className='flex w-72 max-w-full items-center gap-2'>
      <h3 className='truncate text-sm font-medium'>Reading log</h3>
      <StatusNote>{status}</StatusNote>
    </div>
  );
}

export const Saved = meta.story({
  args: { children: 'Saved' },
  render: ({ children }) => <Header status={children} />,
});

export const Asking = meta.story({
  args: { children: 'Asking Lab' },
  render: ({ children }) => <Header status={children} />,
});

const cycle = [undefined, 'Asking Lab', 'Saved'];

function Cycling() {
  const [index, setIndex] = useState(0);

  return (
    <div className='flex flex-col items-start gap-3'>
      <Button
        onClick={() => setIndex((index + 1) % cycle.length)}
        size='sm'
        variant='outline'
      >
        Next status
      </Button>
      <Header status={cycle[index]} />
    </div>
  );
}

export const Changing = meta.story({ render: () => <Cycling /> });
