import { Bookmark, BookmarkX } from 'lucide-react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Chip } from './chip';

const meta = preview.meta({
  component: Chip,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'A small label for something the agent just did. Done is yellow, for a memory Lab saved. Neutral is for the quiet counterpart, like a memory it forgot.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Chip',
});

export const Done = meta.story({
  args: { tone: 'done' },
  render: (args) => (
    <Chip {...args}>
      <Bookmark aria-hidden='true' />
      Remembered
    </Chip>
  ),
});

export const Neutral = meta.story({
  args: { tone: 'neutral' },
  render: (args) => (
    <Chip {...args}>
      <BookmarkX aria-hidden='true' />
      Forgot
    </Chip>
  ),
});
