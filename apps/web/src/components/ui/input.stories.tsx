import preview from '../../../.storybook/preview';
import { Input } from './input';

const meta = preview.meta({
  component: Input,
  args: { 'aria-label': 'Name', placeholder: 'Ada Lovelace' },
  tags: ['autodocs'],
  title: 'Components/Input',
});

export const Default = meta.story({});

export const Password = meta.story({
  args: {
    'aria-label': 'API key',
    placeholder: 'Paste an API key',
    type: 'password',
  },
});

export const Disabled = meta.story({ args: { disabled: true } });
