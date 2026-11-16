import { BudgetPanel } from '@/components/budget';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePersistentState } from '@/lib/storage';
import { type Usage, usageQueryOptions } from '@/lib/usage';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { z } from 'zod';

const ranges = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
];

const rangeSchema = z.number().int();

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: 'currency',
});

const precise = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 4,
  minimumFractionDigits: 2,
  style: 'currency',
});

const compact = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  notation: 'compact',
});

const day = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

function spend(value: number) {
  return value > 0 && value < 1
    ? precise.format(value)
    : currency.format(value);
}

function date(value: string) {
  return day.format(new Date(`${value}T00:00:00Z`));
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex flex-col gap-1 rounded-2xl bg-muted/50 px-4 py-3'>
      <span className='text-xs text-muted-foreground'>{label}</span>
      <span className='text-2xl font-semibold tracking-tight tabular-nums'>
        {value}
      </span>
    </div>
  );
}

function SpendChart({ daily }: { daily: Usage['daily'] }) {
  const max = Math.max(0, ...daily.map(({ cost }) => cost));

  const first = daily[0];
  const last = daily.at(-1);

  return (
    <figure className='flex flex-col gap-3'>
      <figcaption className='text-sm font-medium'>Daily spend</figcaption>
      <div className='flex h-40 items-end gap-0.5 border-b'>
        {daily.map((entry) => (
          <Tooltip key={entry.date}>
            <TooltipTrigger asChild>
              <button
                aria-label={`${date(entry.date)}: ${spend(entry.cost)}`}
                className='group flex h-full min-w-0 flex-1 items-end outline-none focus-visible:bg-accent'
                type='button'
              >
                <span
                  className='w-full rounded-t-sm bg-foreground/50 transition-colors group-hover:bg-foreground group-focus-visible:bg-foreground'
                  style={{
                    height: max > 0 ? `${(entry.cost / max) * 100}%` : 0,
                  }}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {date(entry.date)} · {spend(entry.cost)} ·{' '}
              {compact.format(entry.tokens)} tokens
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      {first && last && (
        <div className='flex justify-between text-xs text-muted-foreground tabular-nums'>
          <span>{date(first.date)}</span>
          <span>{date(last.date)}</span>
        </div>
      )}
    </figure>
  );
}

function Models({ models }: { models: Usage['models'] }) {
  return (
    <section className='flex flex-col gap-2'>
      <h2 className='text-sm font-medium'>By model</h2>
      <table className='w-full text-sm'>
        <thead className='text-xs text-muted-foreground'>
          <tr>
            <th className='py-2 text-left font-normal'>Model</th>
            <th className='py-2 text-right font-normal'>Responses</th>
            <th className='py-2 text-right font-normal'>Tokens</th>
            <th className='py-2 text-right font-normal'>Spend</th>
          </tr>
        </thead>
        <tbody className='tabular-nums'>
          {models.map((model) => (
            <tr key={`${model.provider}:${model.model}`}>
              <td className='py-1.5 pr-4'>
                <span className='block truncate'>{model.name}</span>
              </td>
              <td className='py-1.5 text-right'>{model.responses}</td>
              <td className='py-1.5 text-right'>
                {compact.format(model.input + model.output)}
              </td>
              <td className='py-1.5 text-right'>{spend(model.cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Chats({ conversations }: { conversations: Usage['conversations'] }) {
  return (
    <section className='flex flex-col gap-2'>
      <h2 className='text-sm font-medium'>Most expensive chats</h2>
      <ul className='-mx-3 flex flex-col'>
        {conversations.map(({ cost, id, title }) => (
          <li key={id}>
            <Link
              className='flex items-center justify-between gap-4 rounded-xl px-3 py-1.5 text-sm hover:bg-muted/50'
              params={{ id }}
              to='/c/$id'
            >
              <span className='truncate'>{title ?? 'Deleted chat'}</span>
              <span className='shrink-0 text-muted-foreground tabular-nums'>
                {spend(cost)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function UsagePanel() {
  const [days, setDays] = usePersistentState('usage-range', rangeSchema, 30);

  const usage = useQuery(usageQueryOptions(days));

  return (
    <section className='space-y-8'>
      <div className='flex items-start justify-between gap-4'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-semibold tracking-tight'>Usage</h1>
          <p className='text-sm text-muted-foreground'>
            Spend and tokens across your chats, from provider prices.
          </p>
        </div>
        <Select
          onValueChange={(value) => setDays(Number(value))}
          value={String(days)}
        >
          <SelectTrigger
            aria-label='Range'
            className='h-auto gap-1 border-0 bg-transparent p-0 text-muted-foreground hover:text-foreground data-[size=sm]:h-auto dark:bg-transparent dark:hover:bg-transparent'
            size='sm'
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align='end'>
            {ranges.map((range) => (
              <SelectItem key={range.days} value={String(range.days)}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <BudgetPanel />
      {usage.isError && (
        <p role='alert' className='text-sm text-destructive'>
          Unable to load usage.
        </p>
      )}
      {usage.data && (
        <>
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
            <Stat label='Spend' value={spend(usage.data.summary?.cost ?? 0)} />
            <Stat
              label='Input tokens'
              value={compact.format(usage.data.summary?.input ?? 0)}
            />
            <Stat
              label='Output tokens'
              value={compact.format(usage.data.summary?.output ?? 0)}
            />
            <Stat
              label='Responses'
              value={String(usage.data.summary?.responses ?? 0)}
            />
          </div>
          <SpendChart daily={usage.data.daily} />
          {usage.data.models.length > 0 && (
            <Models models={usage.data.models} />
          )}
          {usage.data.conversations.length > 0 && (
            <Chats conversations={usage.data.conversations} />
          )}
        </>
      )}
    </section>
  );
}
