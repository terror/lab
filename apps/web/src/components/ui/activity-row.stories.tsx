import { X } from 'lucide-react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { ActivityRow } from './activity-row';
import { Button } from './button';
import { Dot } from './dot';
import { LiveMark } from './live-mark';
import { Pips } from './pips';

function MarkRead({ title }: { title: string }) {
  return (
    <Button aria-label={`Mark ${title} as read`} size='icon-sm' variant='quiet'>
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
          'A row for one piece of Lab’s work, built on ListRow: a glyph for its state, a title, one line of detail, and a time. A running row shows the mark thinking, the current step in words, and pips. A finished row shows a coral dot until it is read, and its action takes the place of the time on hover and focus. On a touch screen the time and the action sit side by side. The glyph is hidden from screen readers, so pass label to say the state in words. The meta beside the title shows whole or not at all, and never takes room from the title. Pass renderLink to make the title and detail one link.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Activity row',
});

export const Finished = meta.story({
  render: () => (
    <ul className='flex w-full max-w-120 flex-col gap-0.5 px-3'>
      <ActivityRow
        actions={<MarkRead title='Lisbon trip plan' />}
        detail='Three hotels near the Alfama, all under €140 a night, with the tram stop two minutes away.'
        glyph={<Dot tone='attention' />}
        label='Unread'
        renderLink={(row) => <a href='#foo'>{row}</a>}
        time='2h'
        title='Lisbon trip plan'
      />
      <ActivityRow
        actions={<MarkRead title='Monday motivation' />}
        detail='Here’s this week’s nudge: start with the smallest thing on the list.'
        glyph={<Dot tone='attention' />}
        label='Unread'
        renderLink={(row) => <a href='#foo'>{row}</a>}
        meta='Scheduled'
        time='Yesterday'
        title='Monday motivation'
      />
    </ul>
  ),
});

export const Running = meta.story({
  render: () => (
    <ul className='flex w-full max-w-120 flex-col gap-0.5 px-3'>
      <ActivityRow
        detail='Step 2 of 3 · Checking this week’s forecast'
        glyph={<LiveMark className='size-4' state='thinking' />}
        label='Running'
        renderLink={(row) => <a href='#foo'>{row}</a>}
        progress={<Pips done={1} total={3} />}
        time='1m 12s'
        title='Balcony watering schedule'
      />
      <ActivityRow
        detail='Reading reviews'
        glyph={<LiveMark className='size-4' state='thinking' />}
        label='Running'
        renderLink={(row) => <a href='#foo'>{row}</a>}
        time='8s'
        title='Sourdough starter names'
      />
    </ul>
  ),
});

export const LongTitle = meta.story({
  render: () => (
    <ul className='flex w-full max-w-80 flex-col gap-0.5 px-3'>
      <ActivityRow
        actions={
          <MarkRead title='A very long chat title that cannot fit on one line of a narrow list' />
        }
        detail='A long preview that runs past the edge of the row and is cut with an ellipsis.'
        glyph={<Dot tone='attention' />}
        label='Unread'
        renderLink={(row) => <a href='#foo'>{row}</a>}
        meta='Scheduled'
        time='Nov 12'
        title='A very long chat title that cannot fit on one line of a narrow list'
      />
    </ul>
  ),
});
