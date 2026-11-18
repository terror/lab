import { useEffect, useState } from 'react';
import { expect } from 'storybook/test';

import preview from '../../.storybook/preview';
import { themes } from '../../.storybook/themes';
import { Activity, AssistantMessage } from './assistant-message';

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
      ['call-1', { output: 'Open 9:00 to 17:00', status: 'done' }],
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

const steps = [
  'Reading package.json',
  'Running bun install',
  'Searching for “status”',
  'Reading status.ts',
  'Running the tests',
  'Comparing timings',
];

function RapidActivity() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((current) => current + 1), 150);

    return () => clearInterval(timer);
  }, []);

  return <Activity status={steps[step % steps.length] ?? ''} />;
}

export const RapidSteps = meta.story({ render: () => <RapidActivity /> });

const searches = [
  {
    arguments: { query: 'quiet Lisbon neighbourhoods' },
    id: 'call-1',
    name: 'web_search',
    type: 'toolCall',
  },
  {
    arguments: { url: 'https://example.com' },
    id: 'call-2',
    name: 'web_fetch',
    type: 'toolCall',
  },
  {
    arguments: { query: 'tram lines' },
    id: 'call-3',
    name: 'chat_search',
    type: 'toolCall',
  },
] as const;

function Steps() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((current) => current + 1), 1_200);

    return () => clearInterval(timer);
  }, []);

  const phase = step % 7;

  const replying = phase >= 4;

  return (
    <AssistantMessage
      key={Math.floor(step / 7)}
      parts={[
        ...searches.slice(0, Math.min(phase + 1, searches.length)),
        ...(replying
          ? [{ text: 'Príncipe Real is the quietest.', type: 'text' } as const]
          : []),
      ]}
      progress={new Map()}
      results={
        new Map(
          searches
            .slice(0, phase)
            .map(({ id }) => [id, { output: '', status: 'done' } as const])
        )
      }
      span={{ end: 9_000, start: 0 }}
      streaming
      working
    />
  );
}

export const LiveSteps = meta.story({
  decorators: [themes],
  render: () => <Steps />,
});

const turns = [
  { seconds: 4, steps: 1 },
  { seconds: 38, steps: 3 },
  { seconds: 372, steps: 3 },
];

function Finishes() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((current) => current + 1), 2_400);

    return () => clearInterval(timer);
  }, []);

  const turn = turns[Math.floor(step / 2) % turns.length] ?? turns[0];

  const working = step % 2 === 0;

  const calls = searches.slice(0, turn?.steps);

  return (
    <AssistantMessage
      key={Math.floor(step / 2)}
      latest={!working}
      parts={[
        ...calls,
        { text: 'Príncipe Real is the quietest.', type: 'text' },
      ]}
      progress={new Map()}
      results={
        new Map(
          calls.map(({ id }) => [id, { output: '', status: 'done' } as const])
        )
      }
      span={{ end: (turn?.seconds ?? 0) * 1_000, start: 0 }}
      streaming={working}
      working={working}
    />
  );
}

export const Finishing = meta.story({
  decorators: [themes],
  render: () => <Finishes />,
});
