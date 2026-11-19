import { X } from 'lucide-react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { ActivityRow } from './activity-row';
import { Button } from './button';
import { Dot } from './dot';
import { LiveMark } from './live-mark';
import { Pips } from './pips';

function MarkRead() {
  return (
    <Button aria-label='Mark as read' size='icon-sm' variant='quiet'>
      <X aria-hidden='true' />
    </Button>
  );
}

const meta = preview.meta({
  component: ActivityRow,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'A row for one piece of Lab’s work, built on ListRow: a glyph for its state, a title, one line of detail, and a time. A running row shows the mark thinking, the current step and pips. A finished row shows a coral dot until it is read, and its action takes the place of the time on hover and focus. On a touch screen the time and the action sit side by side. Pass link to make the whole row open something.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Activity row',
});

export const Finished = meta.story({
  render: () => (
    <ul className='flex w-120 flex-col gap-0.5 px-3'>
      <ActivityRow
        actions={<MarkRead />}
        detail='Three hotels near the Alfama, all under €140 a night, with the tram stop two minutes away.'
        glyph={<Dot tone='attention' />}
        link={(row) => <a href='#foo'>{row}</a>}
        time='2h'
        title='Lisbon trip plan'
      />
      <ActivityRow
        actions={<MarkRead />}
        detail='Here’s this week’s nudge: start with the smallest thing on the list.'
        glyph={<Dot tone='attention' />}
        link={(row) => <a href='#foo'>{row}</a>}
        meta='Scheduled'
        time='Yesterday'
        title='Monday motivation'
      />
    </ul>
  ),
});

export const Running = meta.story({
  render: () => (
    <ul className='flex w-120 flex-col gap-0.5 px-3'>
      <ActivityRow
        detail='Checking this week’s forecast'
        glyph={<LiveMark className='size-4' state='thinking' />}
        link={(row) => <a href='#foo'>{row}</a>}
        progress={<Pips done={1} total={3} />}
        time='1m 12s'
        title='Balcony watering schedule'
      />
      <ActivityRow
        detail='Reading reviews'
        glyph={<LiveMark className='size-4' state='thinking' />}
        link={(row) => <a href='#foo'>{row}</a>}
        time='8s'
        title='Sourdough starter names'
      />
    </ul>
  ),
});

export const LongTitle = meta.story({
  render: () => (
    <ul className='flex w-80 flex-col gap-0.5 px-3'>
      <ActivityRow
        actions={<MarkRead />}
        detail='A long preview that runs past the edge of the row and is cut with an ellipsis.'
        glyph={<Dot tone='attention' />}
        link={(row) => <a href='#foo'>{row}</a>}
        meta='Scheduled'
        time='Nov 12'
        title='A very long chat title that cannot fit on one line of a narrow list'
      />
    </ul>
  ),
});
