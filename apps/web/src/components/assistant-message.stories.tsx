import { expect } from 'storybook/test';

import preview from '../../.storybook/preview';
import { AssistantMessage } from './assistant-message';

const answer = `Here is a **three day** plan.

1. Day one: Eastern hills, \`Kodai-ji\` at opening.
2. Day two: Kitayama and the moss garden at \`Shisen-do\`.

\`\`\`ts
const days = ['higashiyama', 'kitayama', 'arashiyama'];
\`\`\``;

const meta = preview.meta({
  component: AssistantMessage,
  args: {
    progress: new Map(),
    results: new Map(),
    streaming: false,
  },
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  title: 'Patterns/Assistant message',
});

export const Answer = meta.story({
  args: { latest: true, parts: [{ text: answer, type: 'text' }] },
});

export const Streaming = meta.story({
  args: {
    parts: [{ text: 'Here is a **three day** plan for', type: 'text' }],
    streaming: true,
  },
});

export const ToolCall = meta.story({
  args: {
    parts: [
      { text: 'Let me check the opening hours.', type: 'text' },
      {
        arguments: { url: 'https://example.com' },
        id: 'call-1',
        name: 'fetch_page',
        type: 'toolCall',
      },
    ],
    results: new Map([
      ['call-1', { isError: false, output: 'Open 9:00 to 17:00' }],
    ]),
  },
});

export const LongRunningStep = meta.story({
  args: {
    parts: [
      {
        arguments: { command: 'foo '.repeat(100) },
        id: 'call-1',
        name: 'sandbox_exec',
        type: 'toolCall',
      },
    ],
    streaming: true,
    working: true,
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBe(canvasElement.clientWidth);
  },
});
