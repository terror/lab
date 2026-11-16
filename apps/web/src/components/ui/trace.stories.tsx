import { TriangleAlert, Wrench } from 'lucide-react';

import preview from '../../../.storybook/preview';
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from './trace';

const meta = preview.meta({
  component: Trace,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  title: 'Components/Trace',
});

export const Steps = meta.story({
  render: () => (
    <Trace>
      <TraceLine status='running'>
        <TraceTitle>Comparing train routes</TraceTitle>
      </TraceLine>
      <TraceCollapsible defaultOpen>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceIcon>
              <Wrench aria-hidden='true' />
            </TraceIcon>
            <TraceTitle>Ran fetch_page</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <pre className='font-mono text-xs'>Open 9:00 to 17:00</pre>
        </TraceCollapsibleContent>
      </TraceCollapsible>
      <TraceLine status='error'>
        <TraceIcon>
          <TriangleAlert aria-hidden='true' />
        </TraceIcon>
        <TraceTitle>fetch_page failed</TraceTitle>
      </TraceLine>
    </Trace>
  ),
});
