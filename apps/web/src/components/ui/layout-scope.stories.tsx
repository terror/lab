import { m } from 'motion/react';
import { useState } from 'react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Button } from './button';
import { LayoutScope } from './layout-scope';

const meta = preview.meta({
  component: LayoutScope,
  decorators: [themes],
  tags: ['autodocs'],
  title: 'Components/Layout scope',
});

const tiles = ['foo', 'bar', 'baz', 'qux', 'quux', 'corge'];

function Shelf() {
  const [order, setOrder] = useState(tiles);

  return (
    <LayoutScope>
      <div className='flex w-64 flex-col gap-4'>
        <div className='grid grid-cols-3 gap-2'>
          {order.map((tile) => (
            <m.div
              key={tile}
              className='flex aspect-square items-center justify-center rounded-xl bg-muted text-sm'
              layout='position'
            >
              {tile}
            </m.div>
          ))}
        </div>
        <Button
          onClick={() => setOrder([...order.slice(1), ...order.slice(0, 1)])}
          size='sm'
          variant='outline'
        >
          Reshelve
        </Button>
      </div>
    </LayoutScope>
  );
}

export const Default = meta.story({ render: () => <Shelf /> });
