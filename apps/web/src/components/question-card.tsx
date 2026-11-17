import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { answerQuestion } from '@/lib/conversations';
import { cn } from '@/lib/utils';
import { useMutation } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';

export function QuestionCard({
  answer,
  callId,
  conversationId,
  options,
  question,
}: {
  answer: string | undefined;
  callId: string;
  conversationId: number | undefined;
  options: readonly string[];
  question: string;
}) {
  const [other, setOther] = useState('');

  const send = useMutation({
    mutationFn: (value: string) =>
      answerQuestion(conversationId ?? 0, { answer: value, callId }),
  });

  const chosen = answer ?? (send.isSuccess ? send.variables : undefined);

  const locked =
    chosen !== undefined || send.isPending || conversationId === undefined;

  const typed = chosen !== undefined && !options.includes(chosen);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    send.mutate(other.trim());
  };

  return (
    <div className='flex flex-col gap-3 rounded-2xl border p-4'>
      <p className='text-sm font-medium'>{question}</p>
      <div className='flex flex-col gap-1.5'>
        {options.map((option) => (
          <button
            key={option}
            aria-pressed={chosen === option}
            className={cn(
              'flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors enabled:hover:bg-muted/50 disabled:cursor-default',
              chosen === option && 'border-foreground/40 bg-muted',
              chosen !== undefined &&
                chosen !== option &&
                'text-muted-foreground'
            )}
            disabled={locked}
            onClick={() => send.mutate(option)}
            type='button'
          >
            {option}
            {chosen === option && (
              <Check aria-hidden='true' className='size-4 shrink-0' />
            )}
          </button>
        ))}
      </div>
      {typed && (
        <p className='text-sm text-muted-foreground'>You answered: {chosen}</p>
      )}
      {chosen === undefined && (
        <form className='flex items-center gap-2' onSubmit={onSubmit}>
          <Input
            aria-label='Another answer'
            autoComplete='off'
            data-1p-ignore
            disabled={locked}
            maxLength={1_000}
            onChange={(event) => setOther(event.target.value)}
            placeholder='Something else…'
            value={other}
          />
          <Button
            disabled={locked || !other.trim()}
            size='sm'
            type='submit'
            variant='secondary'
          >
            Send
          </Button>
        </form>
      )}
      {send.error && (
        <p role='alert' className='text-sm text-destructive'>
          {send.error.message}
        </p>
      )}
    </div>
  );
}
