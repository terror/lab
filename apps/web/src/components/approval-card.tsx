import { Answered } from '@/components/answered';
import { ErrorMessage } from '@/components/error-message';
import { NeedsYou } from '@/components/needs-you';
import { Button } from '@/components/ui/button';
import { useAnswer } from '@/lib/conversations';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { z } from 'zod';

const approvalSchema = z.object({
  action: z.string(),
  decision: z.enum(['approved', 'denied']).optional(),
  summary: z.array(z.string()),
});

function ClampedText({ children }: { children: string }) {
  const paragraph = useRef<HTMLParagraphElement>(null);

  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const element = paragraph.current;

    if (element) {
      setOverflowing(element.scrollHeight > element.clientHeight);
    }
  }, []);

  return (
    <div className='flex flex-col items-start gap-1'>
      <p
        className={cn(
          'text-sm whitespace-pre-wrap text-muted-foreground',
          !expanded && 'line-clamp-3'
        )}
        ref={paragraph}
      >
        {children}
      </p>
      {(overflowing || expanded) && (
        <button
          className='text-xs text-muted-foreground hover:text-foreground'
          onClick={() => setExpanded(!expanded)}
          type='button'
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

const decisions = {
  approved: { icon: Check, label: 'Approved' },
  denied: { icon: X, label: 'Denied' },
};

export function approvalOf(details: unknown) {
  return z.object({ approval: approvalSchema }).safeParse(details).data
    ?.approval;
}

function Scope({ summary }: { summary: readonly string[] }) {
  return summary.map((line) => <ClampedText key={line}>{line}</ClampedText>);
}

export function ApprovalSummary({
  action,
  summary,
}: {
  action: string;
  summary: readonly string[];
}) {
  return (
    <div className='flex flex-col gap-1'>
      <p className='text-sm font-medium'>{action}</p>
      <Scope summary={summary} />
    </div>
  );
}

export function ApprovalCard({
  active,
  approval,
  callId,
  conversationId,
}: {
  active: boolean;
  approval: z.infer<typeof approvalSchema>;
  callId: string;
  conversationId: number | undefined;
}) {
  const send = useAnswer<'approved' | 'denied'>(conversationId, callId);

  const decision =
    approval.decision ?? (send.isSuccess ? send.variables : undefined);

  const shown = decision === undefined ? undefined : decisions[decision];

  const locked = !active || send.isPending || conversationId === undefined;

  return (
    <Answered
      answer={
        shown && (
          <>
            <shown.icon aria-hidden='true' className='size-4 shrink-0' />
            {shown.label}
          </>
        )
      }
      prompt={approval.action}
    >
      <NeedsYou active={active} title={approval.action}>
        {approval.summary.length > 0 && (
          <div className='flex flex-col gap-1'>
            <Scope summary={approval.summary} />
          </div>
        )}
        <div className='flex gap-2'>
          <Button
            disabled={locked}
            onClick={() => send.mutate('approved')}
            size='sm'
            variant='outline'
          >
            Approve
          </Button>
          <Button
            disabled={locked}
            onClick={() => send.mutate('denied')}
            size='sm'
            variant='outline'
          >
            Deny
          </Button>
        </div>
        {send.error && <ErrorMessage>{send.error.message}</ErrorMessage>}
      </NeedsYou>
    </Answered>
  );
}
