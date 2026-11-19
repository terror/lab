import { Clock, Folder, MessageSquare } from 'lucide-react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { ShelfTile } from './shelf-tile';

const meta = preview.meta({
  component: ShelfTile,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'A tile for picking something back up: a glyph in a well, a title, and one line that says what it is. The glyph is monochrome. A tile is a button; pass link to make it open a page instead.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Shelf tile',
});

const tiles = [
  {
    icon: MessageSquare,
    meta: 'Last chat · Yesterday',
    title: 'Quicksort explained',
  },
  { icon: Folder, meta: 'Project', title: 'Balcony garden' },
  { icon: Clock, meta: 'Scheduled · in 4 days', title: 'Monday motivation' },
];

export const Default = meta.story({
  render: () => (
    <ul className='grid w-120 grid-cols-3 gap-1'>
      {tiles.map(({ icon: Icon, meta: line, title }) => (
        <li key={title} className='min-w-0'>
          <ShelfTile
            glyph={<Icon aria-hidden='true' />}
            link={(tile) => <a href='#foo'>{tile}</a>}
            meta={line}
            title={title}
          />
        </li>
      ))}
    </ul>
  ),
});

export const Starter = meta.story({
  render: () => (
    <div className='w-64'>
      <ShelfTile
        glyph={<Clock aria-hidden='true' />}
        meta='Set it once. I’ll run it on time.'
        title='Remind me every Monday'
      />
    </div>
  ),
});
