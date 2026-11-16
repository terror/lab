import preview from '../../.storybook/preview';
import { ProviderLogo } from './provider-logo';

const providers = [
  ['anthropic', 'Anthropic'],
  ['openai', 'OpenAI'],
  ['google', 'Google'],
  ['vercel-ai-gateway', 'Vercel AI Gateway'],
  ['openrouter', 'OpenRouter'],
  ['groq', 'Groq'],
  ['mistral', 'Mistral'],
  ['deepseek', 'DeepSeek'],
  ['xai', 'xAI'],
  ['ant-ling', 'Ant Ling'],
];

const meta = preview.meta({
  component: ProviderLogo,
  tags: ['autodocs'],
  title: 'Patterns/Provider logo',
});

export const Default = meta.story({
  args: { id: 'anthropic', name: 'Anthropic' },
});

export const All = meta.story({
  args: { id: 'anthropic', name: 'Anthropic' },
  render: () => (
    <div className='grid grid-cols-5 gap-4'>
      {providers.map(([id = '', name = '']) => (
        <div key={id} className='flex flex-col items-center gap-2'>
          <ProviderLogo id={id} name={name} />
          <span className='text-xs text-muted-foreground'>{name}</span>
        </div>
      ))}
    </div>
  ),
});
