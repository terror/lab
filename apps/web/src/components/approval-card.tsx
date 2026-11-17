import { Button } from '@/components/ui/button';
import { answerQuestion } from '@/lib/conversations';
import { useMutation } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { z } from 'zod';

const approvalSchema = z.object({
  action: z.string(),
  decision: z.enum(['approved', 'denied']).optional(),
  summary: z.array(z.string()),
});

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
    mutationFn: (answer: 'approved' | 'denied') =>
      answerQuestion(conversationId ?? 0, { answer, callId }),
  });

  const decision =
    approval.decision ?? (send.isSuccess ? send.variables : undefined);

  return (
    <div className='flex flex-col gap-3 rounded-2xl border p-4'>
      <div className='flex flex-col gap-1'>
        <p className='text-sm font-medium'>{approval.action}</p>
        {approval.summary.map((line) => (
          <p key={line} className='text-sm text-muted-foreground'>
            {line}
          </p>
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
      {send.error && (
        <p role='alert' className='text-sm text-destructive'>
          {send.error.message}
        </p>
      )}
    </div>
  );
}
