import { useState } from 'react';

import preview from '../../.storybook/preview';
import type { ModelChoice } from '../lib/models';
import { ModelPicker } from './model-picker';

function Picker({ initial }: { initial: ModelChoice }) {
  const [value, setValue] = useState(initial);

  return <ModelPicker onChange={setValue} value={value} />;
}

const meta = preview.meta({
  component: ModelPicker,
  tags: ['autodocs'],
  title: 'Patterns/Model picker',
});

export const Default = meta.story({
  render: () => (
    <Picker
      initial={{
        id: 'claude-sonnet-5.5',
        provider: 'anthropic',
        thinkingLevel: 'medium',
      }}
    />
  ),
});

export const ThinkingOff = meta.story({
  render: () => (
    <Picker
      initial={{ id: 'gpt-5.5', provider: 'openai', thinkingLevel: 'off' }}
    />
  ),
});
