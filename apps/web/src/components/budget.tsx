import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Meter } from '@/components/ui/meter';
import { formatSpend } from '@/lib/format';
import { usePersistentState } from '@/lib/storage';
import { undoToast } from '@/lib/undo';
import {
  type Budget,
  budgetLevel,
  budgetQueryOptions,
  setBudget,
} from '@/lib/usage';
import { cn } from '@/lib/utils';
import { useQuiet } from '@/lib/voice';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useReducedMotion } from 'motion/react';
import { type SubmitEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

const messages = {
  near: 'You’ve used over 80% of your monthly budget.',
  over: 'You’ve passed your monthly budget.',
};

const pouredKey = 'lab:poured';

function Flask({ limit, spent }: { limit: number; spent: number }) {
  const quiet = useQuiet();
  const reduced = useReducedMotion();

  const [pour] = useState(
    () => window.sessionStorage.getItem(pouredKey) === null
  );

  const poured = pour && !quiet && reduced !== true;

  useEffect(() => {
    if (poured) {
      window.sessionStorage.setItem(pouredKey, 'true');
    }
  }, [poured]);

  return (
    <Meter
      label='Monthly budget used'
      pour={pour}
      tone={budgetLevel({ limit, spent })}
      value={spent / limit}
      className='order-first'
      valueText={`${formatSpend(spent)} of ${formatSpend(limit)}`}
      variant='flask'
    />
  );
}

function month() {
  return new Date().toISOString().slice(0, 7);
}

function Spent({ limit, spent }: { limit: number; spent: number }) {
  const level = budgetLevel({ limit, spent });

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-baseline justify-between text-sm tabular-nums'>
        <span>
          {formatSpend(spent)}{' '}
          <span className='text-muted-foreground'>
            of {formatSpend(limit)} this month
          </span>
        </span>
        <span className='text-muted-foreground'>
          {Math.round((spent / limit) * 100)}%
        </span>
      </div>
      {level && (
        <p
          role='alert'
          className={cn(
            'text-sm',
            level === 'over' ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {messages[level]}
        </p>
      )}
    </div>
  );
}

function BudgetForm({ budget }: { budget: Budget }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(budget.limit?.toString() ?? '');

  const save = useMutation({
    mutationFn: setBudget,
    onSuccess: (next) =>
      queryClient.setQueryData(budgetQueryOptions.queryKey, next),
  });

  const limit = Number(value);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    save.mutate(limit);
  };

  const remove = (previous: number) => {
    setValue('');
    save.mutate(null, {
      onSuccess: () =>
        undoToast('Budget removed.', () => {
          setValue(String(previous));
          save.mutate(previous);
        }),
    });
  };

  const { limit: saved } = budget;

  return (
    <form className='flex items-center gap-2' onSubmit={onSubmit}>
      <Input
        aria-label='Monthly budget in US dollars'
        className='w-32'
        inputMode='decimal'
        min='0.01'
        onChange={(event) => setValue(event.target.value)}
        placeholder='$50'
        step='0.01'
        type='number'
        value={value}
      />
      <Button
        disabled={!(limit > 0) || save.isPending}
        size='sm'
        type='submit'
        variant='secondary'
      >
        Save
      </Button>
      {saved !== null && (
        <Button
          disabled={save.isPending}
          onClick={() => remove(saved)}
          size='sm'
          type='button'
          variant='ghost'
        >
          Remove
        </Button>
      )}
    </form>
  );
}

export function BudgetPanel() {
  const budget = useQuery(budgetQueryOptions);

  if (!budget.data) {
    return null;
  }

  const { limit, spent } = budget.data;

  return (
    <Card className='gap-4' variant='outline'>
      <div className='flex items-start gap-5'>
        <div className='flex min-w-0 flex-1 flex-col gap-4'>
          <div className='flex flex-col gap-1'>
            <h2 className='text-sm font-medium'>Monthly budget</h2>
            <p className='text-sm text-muted-foreground'>
              Get an alert at 80% and 100% of a monthly spend limit.
            </p>
          </div>
          {limit !== null && <Spent limit={limit} spent={spent} />}
        </div>
        {limit !== null && <Flask limit={limit} spent={spent} />}
      </div>
      <BudgetForm budget={budget.data} />
    </Card>
  );
}

const alertedSchema = z.string().optional();

export function BudgetAlert() {
  const budget = useQuery(budgetQueryOptions);
  const [alerted, setAlerted] = usePersistentState(
    'budget-alert',
    alertedSchema,
    undefined
  );

  const navigate = useNavigate();

  const level = budget.data && budgetLevel(budget.data);

  useEffect(() => {
    if (!level) {
      return;
    }

    const key = `${month()}:${level}`;

    if (alerted === key) {
      return;
    }

    toast(messages[level], {
      action: {
        label: 'View usage',
        onClick: () => {
          void navigate({ search: { section: 'usage' }, to: '/settings' });
        },
      },
      duration: 10_000,
      id: 'budget',
    });

    setAlerted(key);
  }, [alerted, level, navigate, setAlerted]);

  return null;
}
