import { BudgetPanel } from '@/components/budget';
import { LoadError } from '@/components/load-error';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { PageHeader } from '@/components/ui/page';
import { Pills } from '@/components/ui/pills';
import { RollingNumber } from '@/components/ui/rolling-number';
import { SectionHeading } from '@/components/ui/section-heading';
import { Skeleton } from '@/components/ui/skeleton';
import { conversationTitle } from '@/lib/conversations';
import { calendarDate, formatSpend, spendFormat } from '@/lib/format';
import { fade, spring } from '@/lib/motion';
import { usePersistentState } from '@/lib/storage';
import { type Usage, usageQueryOptions } from '@/lib/usage';
import { cn } from '@/lib/utils';
import { useQuiet } from '@/lib/voice';
import { type Format } from '@number-flow/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { z } from 'zod';

const ranges = [
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
];

const rangeSchema = z.number().int();

const compactFormat = {
  maximumFractionDigits: 1,
  notation: 'compact',
} as const satisfies Format;

const compact = new Intl.NumberFormat('en-US', compactFormat);

type Day = Usage['daily'][number];

function Stat({
  format,
  label,
  value,
}: {
  format?: Format;
  label: string;
  value: number;
}) {
  return (
    <Card className='gap-1 px-4 py-3' variant='inset'>
      <span className='text-xs text-muted-foreground'>{label}</span>
      <RollingNumber
        className='text-2xl font-semibold tracking-tight'
        format={format}
        value={value}
      />
    </Card>
  );
}

function Caption({ day, daily }: { day: Day | undefined; daily: Day[] }) {
  const max = Math.max(0, ...daily.map(({ cost }) => cost));
  const total = daily.reduce((sum, { cost }) => sum + cost, 0);
  const peak = daily.find(({ cost }) => cost === max);

  if (day) {
    return (
      <m.span
        animate={{ opacity: 1 }}
        className='tabular-nums'
        initial={{ opacity: 0 }}
        transition={fade.fast}
      >
        {calendarDate(day.date)} · {formatSpend(day.cost)} ·{' '}
        {compact.format(day.tokens)} tokens
      </m.span>
    );
  }

  if (!peak || max === 0) {
    return null;
  }

  return (
    <m.span
      animate={{ opacity: 1 }}
      className='text-muted-foreground tabular-nums'
      initial={{ opacity: 0 }}
      transition={fade.fast}
    >
      {formatSpend(total)} in total · peak {formatSpend(max)} on{' '}
      {calendarDate(peak.date)}
    </m.span>
  );
}

function SpendChart({ daily, rise }: { daily: Day[]; rise: boolean }) {
  const [day, setDay] = useState<Day>();

  const max = Math.max(0, ...daily.map(({ cost }) => cost));

  const first = daily[0];
  const last = daily.at(-1);

  const leave = (entry: Day) => {
    setDay((current) => (current === entry ? undefined : current));
  };

  return (
    <figure className='flex flex-col gap-3'>
      <figcaption className='flex flex-col gap-x-4 text-sm sm:flex-row sm:items-baseline sm:justify-between'>
        <span className='font-medium text-muted-foreground'>Daily spend</span>
        <AnimatePresence initial={false} mode='wait'>
          <Caption key={day?.date ?? 'total'} day={day} daily={daily} />
        </AnimatePresence>
      </figcaption>
      <div className='flex h-40 items-end gap-0.5 border-b'>
        {daily.map((entry) => (
          <button
            key={entry.date}
            aria-label={`${calendarDate(entry.date)}: ${formatSpend(entry.cost)}`}
            className='group flex h-full min-w-0 flex-1 items-end focus-ring-inset'
            onBlur={() => leave(entry)}
            onClick={() => setDay(entry)}
            onFocus={() => setDay(entry)}
            onPointerEnter={() => setDay(entry)}
            onPointerLeave={(event) => {
              if (event.pointerType !== 'touch') {
                leave(entry);
              }
            }}
            type='button'
          >
            <m.span
              animate={{ scaleY: 1 }}
              className={cn(
                'min-h-0.5 w-full origin-bottom rounded-t-sm transition-colors',
                entry.cost > 0
                  ? 'bg-foreground/50 group-hover:bg-foreground group-focus-visible:bg-foreground'
                  : 'bg-foreground/10 group-hover:bg-foreground/25'
              )}
              initial={rise && { scaleY: 0 }}
              style={{
                height: max > 0 ? `${(entry.cost / max) * 100}%` : 0,
              }}
              transition={spring.glide}
            />
          </button>
        ))}
      </div>
      {first && last && (
        <div className='flex justify-between text-xs text-muted-foreground tabular-nums'>
          <span>{calendarDate(first.date)}</span>
          <span>{calendarDate(last.date)}</span>
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

  const usage = useQuery({
    ...usageQueryOptions(days),
    placeholderData: keepPreviousData,
  });

  const quiet = useQuiet();
  const reduced = useReducedMotion();

  const [shown, setShown] = useState({ days, risen: false });

  if (usage.isSuccess && !usage.isPlaceholderData && shown.days !== days) {
    setShown({ days, risen: true });
  }

  return (
    <>
      <PageHeader
        description='Estimated costs and token usage.'
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
                format={spendFormat(usage.data.summary?.cost ?? 0)}
                label='Spend'
                value={usage.data.summary?.cost ?? 0}
              />
              <Stat
                format={compactFormat}
                label='Input tokens'
                value={usage.data.summary?.input ?? 0}
              />
              <Stat
                format={compactFormat}
                label='Output tokens'
                value={usage.data.summary?.output ?? 0}
              />
              <Stat
                label='Responses'
                value={usage.data.summary?.responses ?? 0}
              />
            </div>
            <SpendChart
              key={shown.days}
              daily={usage.data.daily}
              rise={shown.risen && !quiet && !reduced}
            />
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
