import { Answered } from '@/components/answered';
import { ErrorMessage } from '@/components/error-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { answerQuestion } from '@/lib/conversations';
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

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    send.mutate(other.trim());
  };

  return (
    <Answered
      answer={
        chosen === undefined ? undefined : (
          <>
            <Check aria-hidden='true' className='size-4 shrink-0' />
            <span className='truncate'>{chosen}</span>
          </>
        )
      }
      prompt={question}
    >
      <Card className='gap-3' variant='outline'>
        <p className='text-sm font-medium'>{question}</p>
        <div className='flex flex-col gap-1.5'>
          {options.map((option) => (
            <Button
              key={option}
              className='h-auto min-h-9 justify-start py-1.5 text-left font-normal whitespace-normal'
              disabled={locked}
              onClick={() => send.mutate(option)}
              variant='outline'
            >
              {option}
            </Button>
          ))}
        </div>
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
        {send.error && <ErrorMessage>{send.error.message}</ErrorMessage>}
      </Card>
    </Answered>
  );
}
