import { ArrowUp } from 'lucide-react';

import preview from '../../../.storybook/preview';
import { Button } from './button';

const meta = preview.meta({
  component: Button,
  args: { children: 'Button' },
  argTypes: {
    size: {
      control: 'select',
      options: [
        'default',
        'xs',
        'sm',
        'lg',
        'icon',
        'icon-xs',
        'icon-sm',
        'icon-lg',
      ],
    },
    variant: {
      control: 'select',
      options: [
        'default',
        'outline',
        'secondary',
        'ghost',
        'destructive',
        'link',
      ],
    },
  },
  tags: ['autodocs'],
  title: 'Components/Button',
});

export const Default = meta.story({});

export const Variants = meta.story({
  render: (args) => (
    <div className='flex flex-wrap items-center gap-2'>
      <Button {...args}>Default</Button>
      <Button {...args} variant='secondary'>
        Secondary
      </Button>
      <Button {...args} variant='outline'>
        Outline
      </Button>
      <Button {...args} variant='ghost'>
        Ghost
      </Button>
      <Button {...args} variant='destructive'>
        Destructive
      </Button>
      <Button {...args} variant='link'>
        Link
      </Button>
    </div>
  ),
});

export const Sizes = meta.story({
  render: (args) => (
    <div className='flex flex-wrap items-center gap-2'>
      <Button {...args} size='xs'>
        Extra small
      </Button>
      <Button {...args} size='sm'>
        Small
      </Button>
      <Button {...args}>Default</Button>
      <Button {...args} size='lg'>
        Large
      </Button>
      <Button {...args} aria-label='Send' className='rounded-full' size='icon'>
        <ArrowUp aria-hidden='true' />
      </Button>
    </div>
  ),
});

export const Disabled = meta.story({ args: { disabled: true } });
