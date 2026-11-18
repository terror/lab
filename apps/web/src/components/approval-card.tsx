import { ErrorMessage } from '@/components/error-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { answerQuestion } from '@/lib/conversations';
import { cn } from '@/lib/utils';
import { useMutation } from '@tanstack/react-query';
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

export function approvalOf(details: unknown) {
  return z.object({ approval: approvalSchema }).safeParse(details).data
    ?.approval;
}

export function ApprovalCard({
  approval,
  callId,
  conversationId,
}: {
  approval: z.infer<typeof approvalSchema>;
  callId: string;
  conversationId: number | undefined;
}) {
  const send = useMutation({
    meta: { inlineError: true },
    mutationFn: (answer: 'approved' | 'denied') =>
      answerQuestion(conversationId ?? 0, { answer, callId }),
  });

  const decision =
    approval.decision ?? (send.isSuccess ? send.variables : undefined);

  return (
    <Card className='gap-3' variant='outline'>
      <div className='flex flex-col gap-1'>
        <p className='text-sm font-medium'>{approval.action}</p>
        {approval.summary.map((line) => (
          <ClampedText key={line}>{line}</ClampedText>
        ))}
      </div>
      {decision === undefined ? (
        <div className='flex gap-2'>
          <Button
            disabled={send.isPending || conversationId === undefined}
            onClick={() => send.mutate('approved')}
            size='sm'
          >
            Approve
          </Button>
          <Button
            disabled={send.isPending || conversationId === undefined}
            onClick={() => send.mutate('denied')}
            size='sm'
            variant='ghost'
          >
            Deny
          </Button>
        </div>
      ) : (
        <p className='flex items-center gap-1.5 text-sm text-muted-foreground'>
          {decision === 'approved' ? (
            <Check aria-hidden='true' className='size-4' />
          ) : (
            <X aria-hidden='true' className='size-4' />
          )}
          {decision === 'approved' ? 'Approved' : 'Denied'}
        </p>
      )}
      {send.error && <ErrorMessage>{send.error.message}</ErrorMessage>}
    </Card>
  );
}
