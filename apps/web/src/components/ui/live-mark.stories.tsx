import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { LiveMark } from './live-mark';

const meta = preview.meta({
  component: LiveMark,
  argTypes: {
    state: {
      control: 'select',
      options: [
        'idle',
        'assemble',
        'thinking',
        'done',
        'proud',
        'handoff',
        'error',
      ],
    },
  },
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'The Lab mark as the one working indicator, for the activity line and the sidebar. Idle is still. Assemble plays once on the home greeting. Thinking loops while the agent works and halves its pace after 5 seconds. Done hops once, and error slips apart and stays apart. Under reduced motion nothing moves: assemble fades in, thinking dims, and error shows its end pose.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Live mark',
});

export const Idle = meta.story({ args: { className: 'size-10' } });

export const Assemble = meta.story({
  args: { className: 'size-10', state: 'assemble' },
});

export const Thinking = meta.story({
  args: { state: 'thinking' },
  render: (args) => (
    <div className='flex items-center gap-6'>
      <LiveMark {...args} className='size-10' />
      <span className='flex items-center gap-2 text-sm text-muted-foreground'>
        <LiveMark {...args} className='size-3.5' />
        Thinking
      </span>
    </div>
  ),
});

export const Done = meta.story({
  args: { className: 'size-10', state: 'done' },
});

export const Proud = meta.story({
  args: { className: 'size-10', state: 'proud' },
});

export const Handoff = meta.story({
  args: { className: 'size-10', state: 'handoff' },
});

export const Error = meta.story({
  args: { className: 'size-10', state: 'error' },
});
