import { BudgetPanel } from '@/components/budget';
import { LoadError } from '@/components/load-error';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { PageHeader } from '@/components/ui/page';
import { Pills } from '@/components/ui/pills';
import { SectionHeading } from '@/components/ui/section-heading';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { conversationTitle } from '@/lib/conversations';
import { formatSpend } from '@/lib/format';
import { usePersistentState } from '@/lib/storage';
import { type Usage, usageQueryOptions } from '@/lib/usage';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { z } from 'zod';

const ranges = [
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
];

const rangeSchema = z.number().int();

const compact = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  notation: 'compact',
});

const day = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

function date(value: string) {
  return day.format(new Date(`${value}T00:00:00Z`));
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className='gap-1 px-4 py-3' variant='inset'>
      <span className='text-xs text-muted-foreground'>{label}</span>
      <span className='text-2xl font-semibold tracking-tight tabular-nums'>
        {value}
      </span>
    </Card>
  );
}

function SpendChart({ daily }: { daily: Usage['daily'] }) {
  const max = Math.max(0, ...daily.map(({ cost }) => cost));
  const total = daily.reduce((sum, { cost }) => sum + cost, 0);
  const peak = daily.find(({ cost }) => cost === max);

  const first = daily[0];
  const last = daily.at(-1);

  return (
    <figure className='flex flex-col gap-3'>
      <figcaption className='flex flex-wrap items-baseline justify-between gap-x-4 text-sm'>
        <span className='font-medium text-muted-foreground'>Daily spend</span>
        {peak && max > 0 && (
          <span className='text-muted-foreground tabular-nums'>
            {formatSpend(total)} in total · peak {formatSpend(max)} on{' '}
            {date(peak.date)}
          </span>
        )}
      </figcaption>
      <div className='flex h-40 items-end gap-0.5 border-b'>
        {daily.map((entry) => (
          <Tooltip key={entry.date}>
            <TooltipTrigger asChild>
              <button
                aria-label={`${date(entry.date)}: ${formatSpend(entry.cost)}`}
                className='group flex h-full min-w-0 flex-1 items-end focus-ring-inset'
                type='button'
              >
                <span
                  className={cn(
                    'min-h-0.5 w-full rounded-t-sm transition-colors',
                    entry.cost > 0
                      ? 'bg-foreground/50 group-hover:bg-foreground group-focus-visible:bg-foreground'
                      : 'bg-foreground/10 group-hover:bg-foreground/25'
                  )}
                  style={{
                    height: max > 0 ? `${(entry.cost / max) * 100}%` : 0,
                  }}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {date(entry.date)} · {formatSpend(entry.cost)} ·{' '}
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
      <SectionHeading>By model</SectionHeading>
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
            <tr key={`${model.provider}:${model.model}`} className='border-t'>
              <td className='py-2 pr-4'>
                <span className='block truncate'>{model.name}</span>
              </td>
              <td className='py-2 text-right'>{model.responses}</td>
              <td className='py-2 text-right'>
                {compact.format(model.input + model.output)}
              </td>
              <td className='py-2 text-right'>{formatSpend(model.cost)}</td>
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
      <SectionHeading>Most expensive chats</SectionHeading>
      <ul className='flex flex-col gap-0.5'>
        {conversations.map(({ cost, id, title }) => (
          <ListRow key={id} asChild>
            <Link params={{ id }} to='/c/$id'>
              <span className='min-w-0 flex-1 truncate'>
                {conversationTitle(title)}
              </span>
              <span className='shrink-0 text-muted-foreground tabular-nums'>
                {formatSpend(cost)}
              </span>
            </Link>
          </ListRow>
        ))}
      </ul>
    </section>
  );
}

function UsageSkeleton() {
  return (
    <div aria-busy='true' className='flex flex-col gap-6'>
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        {[0, 1, 2, 3].map((stat) => (
          <Skeleton key={stat} className='h-17 rounded-card' />
        ))}
      </div>
      <Skeleton className='h-40 rounded-card' />
    </div>
  );
}

export function UsagePanel() {
  const [days, setDays] = usePersistentState('usage-range', rangeSchema, 30);

  const usage = useQuery(usageQueryOptions(days));

  return (
    <>
      <PageHeader
        description='Spend and tokens across your chats, from provider prices.'
        title='Usage'
      />
      <BudgetPanel />
      <section className='flex flex-col gap-4'>
        <SectionHeading
          actions={
            <Pills
              label='Range'
              onValueChange={(value) => setDays(Number(value))}
              options={ranges}
              value={String(days)}
            />
          }
        >
          Spend
        </SectionHeading>
        {usage.isPending && <UsageSkeleton />}
        {usage.isLoadingError && (
          <LoadError onRetry={() => usage.refetch()} subject='usage' />
        )}
        {usage.data?.models.length === 0 && (
          <EmptyState
            description='Spend and tokens show up here after your first chat in this range.'
            title='Nothing spent yet'
          />
        )}
        {usage.data && usage.data.models.length > 0 && (
          <>
            <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
              <Stat
                label='Spend'
                value={formatSpend(usage.data.summary?.cost ?? 0)}
              />
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
          </>
        )}
      </section>
      {usage.data && usage.data.models.length > 0 && (
        <Models models={usage.data.models} />
      )}
      {usage.data && usage.data.conversations.length > 0 && (
        <Chats conversations={usage.data.conversations} />
      )}
    </>
  );
}
