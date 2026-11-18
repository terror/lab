import { RotateCw, TriangleAlert } from 'lucide-react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Button } from './button';
import { EmptyState } from './empty-state';

const meta = preview.meta({
  component: EmptyState,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'What a data view shows when it has nothing. Give it a title, a one-line description, and at most one action. The default glyph is the empty flask. Pass glyph to swap it, for example a warning icon when a load fails.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Empty state',
});

export const Empty = meta.story({
  args: {
    action: (
      <Button size='sm' variant='outline'>
        Start a chat
      </Button>
    ),
    description: 'Tell Lab “remember that…” in any chat.',
    title: 'No memories yet',
  },
});

export const LoadError = meta.story({
  args: {
    action: (
      <Button size='sm' variant='outline'>
        <RotateCw aria-hidden='true' />
        Retry
      </Button>
    ),
    description: 'Check your connection and try again.',
    glyph: <TriangleAlert aria-hidden='true' className='size-5' />,
    title: 'Couldn’t load memories',
  },
});

const poses = [
  ['default', 'Empty shelves'],
  ['drained', 'Nothing to throw out'],
  ['asleep', 'Nothing on the clock'],
  ['puzzled', 'No matches'],
  ['stretching', 'A fresh project'],
  ['tipped', 'Couldn’t load your library'],
] as const;

export const Poses = meta.story({
  args: { description: 'Foo bar.', title: 'Foo' },
  render: (args) => (
    <div className='grid grid-cols-3'>
      {poses.map(([pose, title]) => (
        <EmptyState key={pose} {...args} pose={pose} title={title} />
      ))}
    </div>
  ),
});
