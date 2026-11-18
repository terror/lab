import { useEffect, useState } from 'react';

import preview from '../../.storybook/preview';
import { themes } from '../../.storybook/themes';
import { toolRenderer } from './tools';

const lanes = ['Príncipe Real', 'Campo de Ourique', 'Graça'];

const order = [1, 0, 2];

const meta = preview.meta({
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'Subagents run in parallel lanes. Each lane’s dot pops into a check as it finishes, the count rolls, and once every lane is done the card folds to its header.',
      },
    },
    layout: 'padded',
  },
  tags: ['autodocs'],
  title: 'Patterns/Subagents',
});

function Live() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((current) => current + 1), 900);

    return () => clearInterval(timer);
  }, []);

  const phase = step % 8;

  const finished = order.slice(0, phase);

  return (
    <div key={Math.floor(step / 8)} className='w-96'>
      {toolRenderer('delegate').inline?.({
        active: true,
        args: {},
        callId: 'call-1',
        details: {
          subagents: lanes.map((title, index) => ({
            status: finished.includes(index) ? 'done' : 'running',
            title,
          })),
        },
        history: [],
        output: '',
      })}
    </div>
  );
}

export const Finishing = meta.story({ render: () => <Live /> });
