import { useState } from 'react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Button } from './button';
import { Meter } from './meter';

const meta = preview.meta({
  component: Meter,
  decorators: [themes],
  tags: ['autodocs'],
  title: 'Components/Meter',
});

export const Bar = meta.story({
  args: { className: 'w-48', label: 'Used', value: 0.4 },
});

export const Flask = meta.story({
  args: { label: 'Used', value: 0.4, variant: 'flask' },
});

export const Near = meta.story({
  args: { label: 'Used', tone: 'near', value: 0.85, variant: 'flask' },
});

export const Over = meta.story({
  args: { label: 'Used', tone: 'over', value: 1.1, variant: 'flask' },
});

function Pouring() {
  const [pours, setPours] = useState(0);

  return (
    <div className='flex items-center gap-4'>
      <Meter key={pours} label='Used' pour value={0.6} variant='flask' />
      <Button onClick={() => setPours(pours + 1)} size='sm' variant='outline'>
        Pour again
      </Button>
    </div>
  );
}

export const Pour = meta.story({ render: () => <Pouring /> });
