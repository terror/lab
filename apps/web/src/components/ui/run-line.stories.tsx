import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { LiveMark } from './live-mark';
import {
  RunLine,
  RunLineChevron,
  RunLineLink,
  RunLineNote,
  RunLineSummary,
  RunLineTime,
  RunLineToggle,
  RunLineVerb,
  RunTab,
} from './run-line';
import { TraceCollapsible, TraceCollapsibleContent } from './trace';

const meta = preview.meta({
  component: RunLine,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'The one line at the head of a reply that says what Lab is doing, and that becomes the receipt when the run ends. It is always one row high, so nothing moves when it changes. On a narrow row the summary, the step count and the sources and files drop out, and the verb truncates.',
      },
    },
    layout: 'padded',
  },
  tags: ['autodocs'],
  title: 'Components/Run line',
});

export const Thinking = meta.story({
  render: () => (
    <RunLine mark={<LiveMark className='size-3.5' state='pondering' />}>
      <RunLineVerb live>Thinking</RunLineVerb>
    </RunLine>
  ),
});

export const Working = meta.story({
  render: () => (
    <TraceCollapsible>
      <RunLine mark={<LiveMark className='size-3.5' state='thinking' />}>
        <RunLineVerb live>Reading carris.pt/avisos</RunLineVerb>
        <RunLineTime>34s</RunLineTime>
        <RunLineToggle compact>6 steps</RunLineToggle>
        <RunLineSummary>searched 2 times · read 4 pages</RunLineSummary>
        <RunLineChevron open={false} />
      </RunLine>
      <TraceCollapsibleContent>Six steps</TraceCollapsibleContent>
    </TraceCollapsible>
  ),
});

export const Stalled = meta.story({
  render: () => (
    <TraceCollapsible>
      <RunLine
        mark={<LiveMark className='size-3.5' state='pondering' />}
        stall={1}
      >
        <RunLineVerb live>Thinking</RunLineVerb>
        <RunLineTime>47s</RunLineTime>
        <RunLineToggle compact>6 steps</RunLineToggle>
        <RunLineNote>still on it, the model is slow right now</RunLineNote>
        <RunLineChevron open={false} />
      </RunLine>
      <TraceCollapsibleContent>Six steps</TraceCollapsibleContent>
    </TraceCollapsible>
  ),
});

export const Receipt = meta.story({
  render: () => (
    <TraceCollapsible>
      <RunLine mark={<LiveMark className='size-3.5' />}>
        <RunLineVerb>Worked for 1m 17s</RunLineVerb>
        <RunLineToggle>9 steps</RunLineToggle>
        <RunLineLink detail>3 sources</RunLineLink>
        <RunLineLink detail>1 file</RunLineLink>
        <RunLineLink tone='error'>1 failed</RunLineLink>
        <RunLineChevron open={false} />
      </RunLine>
      <TraceCollapsibleContent>Nine steps</TraceCollapsibleContent>
    </TraceCollapsible>
  ),
});

export const OneStep = meta.story({
  render: () => (
    <TraceCollapsible>
      <RunLine>
        <RunLineToggle lead>Searched your chats for “garden”</RunLineToggle>
        <RunLineNote>3 chats</RunLineNote>
        <RunLineChevron open={false} />
      </RunLine>
      <TraceCollapsibleContent>Three chats</TraceCollapsibleContent>
    </TraceCollapsible>
  ),
});

export const Narrow = meta.story({
  render: () => (
    <div className='flex w-72 flex-col gap-3'>
      <TraceCollapsible>
        <RunLine mark={<LiveMark className='size-3.5' state='thinking' />}>
          <RunLineVerb live>
            Searching your chats for “balcony herb garden layout”
          </RunLineVerb>
          <RunLineTime>1m 12s</RunLineTime>
          <RunLineToggle compact>12 steps</RunLineToggle>
          <RunLineNote>You can leave this</RunLineNote>
          <RunLineSummary>searched 2 times · read 4 pages</RunLineSummary>
          <RunLineChevron open={false} />
        </RunLine>
        <TraceCollapsibleContent>Twelve steps</TraceCollapsibleContent>
      </TraceCollapsible>
      <p className='text-sm'>The line above stays one row high.</p>
    </div>
  ),
});

export const Docked = meta.story({
  render: () => (
    <div className='flex items-end gap-3'>
      <RunTab>
        <span className='sr-only'>Show what Lab is doing: </span>
        <RunLine fit mark={<LiveMark className='size-3.5' state='thinking' />}>
          <RunLineVerb live>Reading carris.pt/avisos</RunLineVerb>
          <RunLineTime>34s</RunLineTime>
        </RunLine>
      </RunTab>
      <RunTab>
        <RunLine fit mark={<LiveMark className='size-3.5' state='waiting' />}>
          <RunLineVerb className='text-status-attention-ink'>
            Needs you
          </RunLineVerb>
          <RunLineNote>Which neighbourhood?</RunLineNote>
        </RunLine>
      </RunTab>
    </div>
  ),
});
