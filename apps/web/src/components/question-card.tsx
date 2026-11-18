import { ErrorMessage } from '@/components/error-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
    meta: { inlineError: true },
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
    <Card className='gap-3' variant='outline'>
      <p className='text-sm font-medium'>{question}</p>
      <div className='flex flex-col gap-1.5'>
        {options.map((option) => (
          <Button
            key={option}
            aria-pressed={chosen === option}
            className={cn(
              'h-auto min-h-9 justify-between gap-3 py-1.5 text-left font-normal whitespace-normal disabled:opacity-100',
              chosen === option && 'border-foreground/40 bg-muted',
              chosen !== undefined &&
                chosen !== option &&
                'text-muted-foreground'
            )}
            disabled={locked}
            onClick={() => send.mutate(option)}
            variant='outline'
          >
            {option}
            {chosen === option && <Check aria-hidden='true' />}
          </Button>
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
          <Button disabled={locked || !other.trim()} size='sm' type='submit'>
            Send
          </Button>
        </form>
      )}
      {send.error && <ErrorMessage>{send.error.message}</ErrorMessage>}
    </Card>
  );
}
