import {
  AnimatePresence,
  m,
  useIsPresent,
  usePresenceData,
} from 'motion/react';
import { useState } from 'react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { dissolve } from '../../lib/motion';
import { Button } from './button';
import { Dissolve } from './dissolve';

const meta = preview.meta({
  component: Dissolve,
  decorators: [themes],
  tags: ['autodocs'],
  title: 'Components/Dissolve',
});

const names = ['foo', 'bar', 'baz'];

function Row({ index, name }: { index: number; name: string }) {
  const present = useIsPresent();
  const emptying = usePresenceData() === true;

  return (
    <m.li
      className='overflow-hidden'
      exit='gone'
      variants={{ gone: (all: boolean) => dissolve(all ? index : 0) }}
    >
      <Dissolve
        active={!present}
        className='flex-col py-1.5'
        order={emptying ? index : 0}
      >
        <span className='font-medium'>{name}</span>
        <span className='text-muted-foreground'>Deleted Nov 3</span>
      </Dissolve>
    </m.li>
  );
}

function Shelf() {
  const [rows, setRows] = useState(names);
  const [emptying, setEmptying] = useState(false);

  return (
    <div className='flex w-64 flex-col gap-4 text-sm'>
      <ul className='flex min-h-36 flex-col'>
        <AnimatePresence custom={emptying} initial={false}>
          {rows.map((name, index) => (
            <Row key={name} index={index} name={name} />
          ))}
        </AnimatePresence>
      </ul>
      <div className='flex gap-2'>
        <Button
          disabled={rows.length === 0}
          onClick={() => setRows(rows.slice(1))}
          size='sm'
          variant='outline'
        >
          Delete forever
        </Button>
        <Button
          disabled={rows.length === 0}
          onClick={() => {
            setEmptying(true);
            setRows([]);
          }}
          size='sm'
          variant='outline'
        >
          Empty trash
        </Button>
        <Button
          onClick={() => {
            setEmptying(false);
            setRows(names);
          }}
          size='sm'
          variant='ghost'
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

export const Default = meta.story({ render: () => <Shelf /> });
