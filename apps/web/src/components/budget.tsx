import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatSpend } from '@/lib/format';
import { usePersistentState } from '@/lib/storage';
import {
  type Budget,
  budgetLevel,
  budgetQueryOptions,
  setBudget,
} from '@/lib/usage';
import { cn } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type SubmitEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

const messages = {
  near: 'You’ve used over 80% of your monthly budget.',
  over: 'You’ve passed your monthly budget.',
};

function month() {
  return new Date().toISOString().slice(0, 7);
}

function Meter({ limit, spent }: { limit: number; spent: number }) {
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
      <div className='h-1.5 overflow-hidden rounded-full bg-muted'>
        <div
          className={cn(
            'h-full rounded-full bg-foreground transition-all',
            level === 'over' && 'bg-destructive'
          )}
          style={{ width: `${Math.min(100, (spent / limit) * 100)}%` }}
        />
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
      {budget.limit !== null && (
        <Button
          disabled={save.isPending}
          onClick={() => {
            setValue('');
            save.mutate(null);
          }}
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

  return (
    <section className='flex flex-col gap-4 rounded-2xl bg-muted/50 p-4'>
      <div className='space-y-1'>
        <h2 className='text-sm font-medium'>Monthly budget</h2>
        <p className='text-sm text-muted-foreground'>
          Get an alert at 80% and 100% of a monthly spend limit.
        </p>
      </div>
      {budget.data.limit !== null && (
        <Meter limit={budget.data.limit} spent={budget.data.spent} />
      )}
      <BudgetForm budget={budget.data} />
    </section>
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
