import { ArrowUp, Copy, Pencil } from 'lucide-react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Button } from './button';

const meta = preview.meta({
  component: Button,
  args: { children: 'Button' },
  argTypes: {
    size: {
      control: 'select',
      options: ['default', 'sm', 'icon', 'icon-sm', 'icon-xs'],
    },
    variant: {
      control: 'select',
      options: [
        'default',
        'outline',
        'secondary',
        'ghost',
        'quiet',
        'destructive',
        'link',
      ],
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Use default for the one primary action in a view, quiet for icon buttons and low-emphasis actions, and destructive for irreversible ones. Sizes are 32px (default, icon) and 28px (sm, icon-sm), and icon-xs is 24px for dense inline controls. On a touch screen every size has a 44px hit area.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Button',
});

export const Default = meta.story({});

export const Variants = meta.story({
  decorators: [themes],
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
      <Button {...args} variant='quiet'>
        Quiet
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
  decorators: [themes],
  render: (args) => (
    <div className='flex flex-wrap items-center gap-2'>
      <Button {...args}>Default</Button>
      <Button {...args} size='sm'>
        Small
      </Button>
      <Button {...args} aria-label='Send' className='rounded-full' size='icon'>
        <ArrowUp aria-hidden='true' />
      </Button>
      <Button {...args} aria-label='Edit' size='icon' variant='quiet'>
        <Pencil aria-hidden='true' />
      </Button>
      <Button {...args} aria-label='Copy' size='icon-sm' variant='quiet'>
        <Copy aria-hidden='true' />
      </Button>
      <Button {...args} aria-label='Copy' size='icon-xs' variant='quiet'>
        <Copy aria-hidden='true' />
      </Button>
    </div>
  ),
});

export const Disabled = meta.story({ args: { disabled: true } });
