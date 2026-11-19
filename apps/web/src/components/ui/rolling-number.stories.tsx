import { useState } from 'react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Button } from './button';
import { RollingNumber } from './rolling-number';

const meta = preview.meta({
  component: RollingNumber,
  decorators: [themes],
  tags: ['autodocs'],
  title: 'Components/Rolling number',
});

const spends = [0.0987, 1.24, 12.4];

function Spend() {
  const [index, setIndex] = useState(0);

  return (
    <div className='flex items-center gap-4'>
      <span className='text-2xl font-semibold tracking-tight'>
        <RollingNumber
          format={{ currency: 'USD', style: 'currency' }}
          value={spends[index] ?? 0}
        />
      </span>
      <Button
        onClick={() => setIndex((index + 1) % spends.length)}
        size='sm'
        variant='outline'
      >
        Change range
      </Button>
    </div>
  );
}

export const Default = meta.story({ args: { value: 1234 } });

export const Compact = meta.story({
  args: {
    format: { maximumFractionDigits: 1, notation: 'compact' },
    value: 48200,
  },
});

export const Rolling = meta.story({ render: () => <Spend /> });
