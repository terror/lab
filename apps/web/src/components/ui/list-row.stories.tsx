import { Pencil, Trash2 } from 'lucide-react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Button } from './button';
import { ListRow } from './list-row';

const meta = preview.meta({
  component: ListRow,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'One row recipe: 44px tall, a hover fill, and trailing actions that appear on hover and focus and stay visible on a touch screen. The fill runs 12px past the list on both sides, so row text lines up with the heading above it. The row does that itself, so take -mx-3 off a list whose rows become ListRow. Pass className mx-0 where the list has less room than that. Pass asChild with a link to make the content of the row the link.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/List row',
});

const memories = [
  { date: 'Nov 12', text: 'Vegetarian, eats fish now and then' },
  { date: 'Nov 9', text: 'Prefers metric units' },
  { date: 'Oct 30', text: 'Lives in Porto, works remotely' },
];

export const WithActions = meta.story({
  render: () => (
    <ul className='flex w-96 flex-col gap-0.5'>
      {memories.map(({ date, text }) => (
        <ListRow
          key={text}
          actions={
            <>
              <Button aria-label='Edit' size='icon-sm' variant='quiet'>
                <Pencil aria-hidden='true' />
              </Button>
              <Button aria-label='Forget' size='icon-sm' variant='quiet'>
                <Trash2 aria-hidden='true' />
              </Button>
            </>
          }
        >
          <span className='min-w-0 flex-1 truncate'>{text}</span>
          <span className='text-xs text-muted-foreground tabular-nums'>
            {date}
          </span>
        </ListRow>
      ))}
    </ul>
  ),
});

export const AsLink = meta.story({
  render: () => (
    <ul className='flex w-96 flex-col gap-0.5'>
      {memories.map(({ text }) => (
        <ListRow key={text} asChild>
          <a href='#foo'>
            <span className='min-w-0 flex-1 truncate'>{text}</span>
          </a>
        </ListRow>
      ))}
    </ul>
  ),
});
