import { useEffect, useState } from 'react';
import { expect } from 'storybook/test';

import preview from '../../.storybook/preview';
import { themes } from '../../.storybook/themes';
import { useThinking } from '../lib/voice';
import { AssistantMessage } from './assistant-message';
import { Activity } from './tool-steps';
import { ToolConversation } from './tools';

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

const reply =
  'Graça sits high on one of Lisbon’s hills, so the cafés up there stay calm even at weekends. Two are worth the climb: the kiosk under the pines beside the miradouro, and a small bookish bar a street back from the tram line.';

function Reply() {
  const words = reply.split(' ');
  const [count, setCount] = useState(0);

  const streaming = count < words.length;

  useEffect(() => {
    if (!streaming) {
      return undefined;
    }

    const timer = setInterval(() => setCount((current) => current + 1), 70);

    return () => clearInterval(timer);
  }, [streaming]);

  return (
    <AssistantMessage
      parts={[{ text: words.slice(0, count).join(' '), type: 'text' }]}
      progress={new Map()}
      results={new Map()}
      streaming={streaming}
    />
  );
}

export const StreamingReply = meta.story({
  decorators: [themes],
  render: () => <Reply />,
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

function Waiting() {
  return <Activity status={useThinking('foo')} />;
}

export const LongWait = meta.story({
  decorators: [themes],
  render: () => <Waiting />,
});

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

const asks = [
  { decision: undefined, id: 'a', until: 9.5 },
  { decision: 'approved', id: 'a', until: 12 },
  { decision: undefined, id: 'b', until: 15 },
  { decision: 'denied', id: 'b', until: 18 },
] as const;

function Asks() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((current) => current + 1), 500);

    return () => clearInterval(timer);
  }, []);

  const round = Math.floor(tick / 36);

  const ask = asks.find(({ until }) => (tick % 36) / 2 < until) ?? asks[0];

  const id = `${round}-${ask.id}`;

  const details = {
    approval: {
      action: 'Schedule “Monday motivation”',
      decision: ask.decision,
      summary: ['Every Monday at 9:00'],
    },
  };

  return (
    <ToolConversation value={1}>
      <AssistantMessage
        key={id}
        parts={[
          { arguments: {}, id, name: 'schedule_create', type: 'toolCall' },
        ]}
        progress={new Map([[id, { details, output: '', status: 'running' }]])}
        results={
          new Map(
            ask.decision === 'denied'
              ? [[id, { details, output: '', status: 'done' } as const]]
              : []
          )
        }
        streaming
        working
      />
    </ToolConversation>
  );
}

export const Asking = meta.story({
  decorators: [themes],
  render: () => <Asks />,
});

const tries = [
  { key: 'a', state: 'working', until: 2 },
  { key: 'a', state: 'worked', until: 4 },
  { key: 'a', state: 'working', until: 6 },
  { key: 'a', state: 'failed', until: 9.5 },
  { key: 'a', state: 'retrying', until: 10.5 },
  { key: 'b', state: 'working', until: 12.5 },
  { key: 'b', state: 'failed', until: 16 },
] as const;

const outcomes = {
  failed: { failure: 'model_error', retrying: false, working: false },
  retrying: { failure: 'model_error', retrying: true, working: false },
  worked: { failure: undefined, retrying: false, working: false },
  working: { failure: undefined, retrying: false, working: true },
} as const;

function Tries() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((current) => current + 1), 500);

    return () => clearInterval(timer);
  }, []);

  const attempt =
    tries.find(({ until }) => (tick % 32) / 2 < until) ?? tries[0];

  const { failure, retrying, working } = outcomes[attempt.state];

  return (
    <AssistantMessage
      key={`${Math.floor(tick / 32)}-${attempt.key}`}
      failure={failure}
      latest={!working}
      onRetry={failure && !retrying ? () => undefined : undefined}
      parts={[{ text: 'Príncipe Real is the quietest.', type: 'text' }]}
      progress={new Map()}
      results={new Map()}
      retrying={retrying}
      streaming={working}
      working={working}
    />
  );
}

export const Failing = meta.story({
  decorators: [themes],
  render: () => <Tries />,
});
