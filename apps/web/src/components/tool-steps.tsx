import { ApprovalCard, approvalOf } from '@/components/approval-card';
import {
  failedTitle,
  ToolBody,
  ToolConversation,
  ToolHistory,
  type ToolProgress,
  type ToolRecord,
  toolRenderer,
  type ToolResult,
  type ToolView,
} from '@/components/tools';
import { StatusIcon } from '@/components/ui/status-icon';
import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/components/ui/trace';
import { NOTABLE_MS, type Step } from '@/lib/spans';
import { duration } from '@/lib/time';
import type { Part, Span } from '@/lib/transcript';
import { useContext, useState } from 'react';

export type CallStatus = ToolResult['status'] | 'running';

const steps: Record<
  CallStatus,
  { label?: string; line?: 'error' | 'pending' | 'running' }
> = {
  done: {},
  failed: { line: 'error' },
  running: { line: 'running' },
  stopped: { label: 'Stopped', line: 'pending' },
};

export type Call = Extract<Part, { type: 'toolCall' }>;

export function callStatus(
  result: ToolResult | undefined,
  working: boolean
): CallStatus {
  if (result) {
    return result.status;
  }

  return working ? 'running' : 'stopped';
}

export function toolView(
  call: Call,
  progress: ToolProgress | undefined,
  result: ToolResult | undefined,
  working: boolean,
  history: readonly ToolRecord[]
) {
  const status = callStatus(result, working);

  return {
    active: status === 'running',
    args: call.arguments,
    callId: call.id,
    details: result?.details ?? progress?.details,
    history,
    output: result?.output ?? progress?.output ?? '',
    status,
  };
}

function useToolView(
  call: Call,
  progress: ToolProgress | undefined,
  result: ToolResult | undefined,
  working: boolean
) {
  return toolView(call, progress, result, working, useContext(ToolHistory));
}

type CallProps = {
  call: Call;
  progress: ToolProgress | undefined;
  result: ToolResult | undefined;
  working: boolean;
};

const TIMED_MS = NOTABLE_MS / 3;

function took(span: Span | undefined) {
  return span && span.end - span.start >= TIMED_MS
    ? duration(span.end - span.start)
    : undefined;
}

export function stepTitle(name: string, view: ToolView, status: CallStatus) {
  const renderer = toolRenderer(name);

  const active = renderer.title({ ...view, active: true });

  const titles: Record<CallStatus, string> = {
    done: renderer.title({ ...view, active: false }),
    failed: failedTitle(active),
    running: active,
    stopped: active,
  };

  return titles[status];
}

export function stepSummary(name: string, view: ToolView, status: CallStatus) {
  return steps[status].label ?? toolRenderer(name).summary?.(view);
}

export function ToolStep({
  call,
  progress,
  result,
  span,
  working,
}: CallProps & { span?: Span }) {
  const { status, ...view } = useToolView(call, progress, result, working);

  const [first] = useState(status);

  const summary = stepSummary(call.name, view, status);

  const Icon = toolRenderer(call.name).icon;

  const ticked = first === 'running' && status === 'done';

  const time = took(span ?? result?.span);

  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>
        <TraceLine className='h-6.5' status={steps[status].line} tick={ticked}>
          <TraceIcon className='relative'>
            {ticked && <Icon aria-hidden='true' className='absolute' />}
            <StatusIcon status={status} />
          </TraceIcon>
          <TraceTitle>{stepTitle(call.name, view, status)}</TraceTitle>
          {summary && (
            <span className='shrink-0 text-muted-foreground/70'>
              · {summary}
            </span>
          )}
          {time && <TraceDescription>· {time}</TraceDescription>}
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent className='mt-1.5 mb-2 ml-0 flex flex-col gap-3 border-l-0 pl-0'>
        <ToolBody {...view} name={call.name} />
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}

export function resultId(callId: string) {
  return `result-${callId}`;
}

export function approvalId(callId: string) {
  return `approval-${callId}`;
}

export function ToolCards({ call, progress, result, working }: CallProps) {
  const view = useToolView(call, progress, result, working);

  const [live] = useState(view.active);

  const conversationId = useContext(ToolConversation);

  const approval = approvalOf(view.details);

  const inline = toolRenderer(call.name).inline?.(view);

  return (
    <>
      {approval && (
        <div
          className='mt-1.5 mb-2 rounded-card'
          id={approvalId(call.id)}
          tabIndex={-1}
        >
          <ApprovalCard
            active={view.active}
            approval={approval}
            callId={call.id}
            conversationId={conversationId}
          />
        </div>
      )}
      {inline && (
        <div
          className='mt-1.5 mb-2 rounded-card'
          data-arrived={live || undefined}
          id={resultId(call.id)}
          tabIndex={-1}
        >
          {inline}
        </div>
      )}
    </>
  );
}

const pauses = { thought: 'Thought', waited: 'Waited on the model' };

export function Pause({
  kind,
  span,
}: Pick<Extract<Step, { kind: 'thought' | 'waited' }>, 'kind' | 'span'>) {
  return (
    <TraceLine className='h-6.5'>
      <TraceIcon>
        <span className='size-1 rounded-full bg-muted-foreground/60' />
      </TraceIcon>
      <TraceTitle>{pauses[kind]}</TraceTitle>
      <TraceDescription>· {duration(span.end - span.start)}</TraceDescription>
    </TraceLine>
  );
}
