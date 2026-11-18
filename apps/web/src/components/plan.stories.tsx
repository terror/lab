import { useEffect, useState } from 'react';

import preview from '../../.storybook/preview';
import { themes } from '../../.storybook/themes';
import { Plan } from './plan';

const texts = [
  'Pick a quiet neighbourhood',
  'Day-by-day itinerary',
  'Rough budget in euros',
];

const meta = preview.meta({
  component: Plan,
  decorators: [themes],
  parameters: {
    a11y: { config: { rules: [{ enabled: false, id: 'landmark-unique' }] } },
    docs: {
      description: {
        component:
          'Each check draws, the strikethrough sweeps, and the count rolls. When the last step is done the count turns yellow and one burst of pixel confetti fires, once per plan. Under reduced motion the count swaps and no confetti loads.',
      },
    },
    layout: 'padded',
  },
  tags: ['autodocs'],
  title: 'Patterns/Plan',
});

function status(index: number, step: number) {
  if (index < step) {
    return 'done';
  }

  return index === step ? 'active' : 'pending';
}

function Live() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((current) => current + 1), 1_200);

    return () => clearInterval(timer);
  }, []);

  const phase = step % 6;

  return (
    <Plan
      key={Math.floor(step / 6)}
      editable={false}
      steps={texts.map((text, index) => ({
        status: status(index, phase),
        text,
      }))}
    />
  );
}

export const Completing = meta.story({ render: () => <Live /> });

export const Finished = meta.story({
  args: {
    editable: false,
    steps: texts.map((text) => ({ status: 'done', text })),
  },
});
