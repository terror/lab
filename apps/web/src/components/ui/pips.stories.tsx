import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Pips } from './pips';

const meta = preview.meta({
  component: Pips,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'One square for each step of a plan: blue for a finished step, a lighter blue for the step in progress. Pips are still and hidden from screen readers, so always put the words beside them. A plan of more than eight steps shows no pips, only the words.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Pips',
});

export const Default = meta.story({
  args: { done: 2, total: 5 },
  render: (args) => (
    <span className='flex items-center gap-2 text-sm text-muted-foreground'>
      Step 3 of 5
      <Pips {...args} />
    </span>
  ),
});

export const Progress = meta.story({
  render: () => (
    <div className='flex flex-col gap-3 text-sm text-muted-foreground'>
      {[0, 1, 4, 8].map((done) => (
        <span key={done} className='flex items-center gap-2'>
          <span className='w-24 tabular-nums'>{done} of 8 done</span>
          <Pips done={done} total={8} />
        </span>
      ))}
    </div>
  ),
});

export const LongPlan = meta.story({
  args: { done: 3, total: 12 },
  render: (args) => (
    <span className='flex items-center gap-2 text-sm text-muted-foreground'>
      Step 4 of 12
      <Pips {...args} />
    </span>
  ),
});
