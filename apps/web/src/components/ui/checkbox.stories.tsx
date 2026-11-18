import { useId } from 'react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Checkbox } from './checkbox';

function Step({
  label,
  ...props
}: React.ComponentProps<typeof Checkbox> & { label: string }) {
  const id = useId();

  return (
    <div className='flex min-h-7 items-center gap-2.5 text-sm'>
      <Checkbox id={id} {...props} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

const meta = preview.meta({
  component: Checkbox,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component: 'A checkbox whose check draws in. Pair it with a label.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Checkbox',
});

export const Default = meta.story({
  render: (args) => (
    <div className='flex flex-col gap-1'>
      <Step {...args} defaultChecked label='Pick a neighbourhood' />
      <Step {...args} label='Day-by-day itinerary' />
      <Step {...args} defaultChecked disabled label='Rough budget in euros' />
    </div>
  ),
});
