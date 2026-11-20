import { useState } from 'react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Brief, BriefToken } from './brief';
import { Button } from './button';

const meta = preview.meta({
  component: Brief,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'One sentence that says where Lab’s work stands. Each count is a button that jumps to its items, and a count rolls when it changes. Only the count that needs you carries a dot. Pass still to Brief for the plain form, which lists the counts and never rolls. The sentence is a polite live region, so a screen reader hears it again when a count changes. On a touch screen a count’s hit area reaches 44px into free space, and a tap on a count always lands on that count.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Brief',
});

function Sentence() {
  const [running, setRunning] = useState(1);

  const finished = 2 - running;

  return (
    <div className='flex w-96 flex-col items-center gap-4 text-center'>
      <Brief>
        <BriefToken count={finished}>
          {finished === 1 ? 'chat finished' : 'chats finished'}
        </BriefToken>{' '}
        and{' '}
        <BriefToken attention count={1}>
          needs you
        </BriefToken>
        .{' '}
        {running > 0 && (
          <>
            <BriefToken count={running}>is still running</BriefToken>.
          </>
        )}
      </Brief>
      <Button
        onClick={() => setRunning(1 - running)}
        size='sm'
        variant='outline'
      >
        {running > 0 ? 'Finish the run' : 'Start a run'}
      </Button>
    </div>
  );
}

export const Default = meta.story({ render: () => <Sentence /> });

export const Plain = meta.story({
  render: () => (
    <Brief className='w-96 text-center' still>
      <BriefToken count={1}>finished</BriefToken> ·{' '}
      <BriefToken attention count={1}>
        needs you
      </BriefToken>{' '}
      · <BriefToken count={1}>running</BriefToken>
    </Brief>
  ),
});
