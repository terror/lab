import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Dot } from './dot';

const meta = preview.meta({
  component: Dot,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'A 7px marker beside a row. Live is blue and pulses on a step or a subagent lane that is running. Attention is coral and still, on a chat that needs you. Raw coral is 2.3:1 on a light surface and the dot is hidden from screen readers, so give that row a medium-weight title and screen-reader text too. For a running chat in the activity line or the sidebar, use LiveMark, not a dot.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Dot',
});

export const Live = meta.story({
  args: { tone: 'live' },
  render: (args) => (
    <span className='flex items-center gap-2.5 text-sm'>
      <Dot {...args} />
      Reading reviews
    </span>
  ),
});

export const Attention = meta.story({
  args: { tone: 'attention' },
  render: (args) => (
    <span className='flex w-56 items-center gap-2.5 text-sm font-medium'>
      <span className='flex-1 truncate'>Sourdough starter names</span>
      <Dot {...args} />
      <span className='sr-only'>Needs you</span>
    </span>
  ),
});
