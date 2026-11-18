import { FileText, Globe } from 'lucide-react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Button } from './button';
import { Card } from './card';

const meta = preview.meta({
  component: Card,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'An outline card asks you something: a pending question, an approval. An inset card holds read-only agent output: tool results, the plan, subagent lanes, an answered question.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Card',
});

export const Outline = meta.story({
  args: { variant: 'outline' },
  render: (args) => (
    <Card {...args} className='w-72'>
      <p className='text-sm font-medium'>Which vibe should the names have?</p>
      <div className='flex flex-col gap-1.5'>
        <Button className='justify-start' variant='outline'>
          Cute and cuddly
        </Button>
        <Button className='justify-start' variant='outline'>
          Funny and punny
        </Button>
      </div>
    </Card>
  ),
});

export const Inset = meta.story({
  args: { variant: 'inset' },
  render: (args) => (
    <Card {...args} className='w-72 text-sm text-muted-foreground'>
      <p>Worked for 9s · 2 steps</p>
      <p className='flex items-center gap-2'>
        <Globe aria-hidden='true' className='size-4' />
        Searched the web
      </p>
      <p className='flex items-center gap-2'>
        <FileText aria-hidden='true' className='size-4' />
        Read 4 pages
      </p>
    </Card>
  ),
});
