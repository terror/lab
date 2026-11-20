import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Label } from '@/components/ui/label';
import { LiveMark } from '@/components/ui/live-mark';
import { Switch } from '@/components/ui/switch';
import { useMoment } from '@/lib/moment';
import { type Moment, type MomentId, moments } from '@/lib/moments';
import { preferencesQueryOptions } from '@/lib/preferences';
import { clearStored } from '@/lib/storage';
import { defaultPreferences } from '@lab/server/schemas';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useId, useRef, useState } from 'react';

type Limit = NonNullable<Moment['budget']>[number];

const tiers = {
  ambient: 'Every interaction. A permission and nothing more.',
  run: 'Once per run, task, arrival or visit.',
  landmark: 'Firsts and thresholds. Always capped.',
  egg: 'Only when sought.',
} satisfies Record<Moment['tier'], string>;

const spans = {
  day: 'a day',
  ever: 'ever',
  session: 'a session',
  tick: 'at once',
} satisfies Record<Limit['per'], string>;

const quiets = { keep: 'Kept', skip: 'Off' };

const reductions = {
  skip: 'Off',
  still: 'No motion',
} satisfies Record<Moment['reduced'], string>;

function hiddenText({ budget, hidden, ms }: Moment) {
  if (hidden === 'wait') {
    return 'Waits to be seen';
  }

  return budget === undefined && ms === undefined ? '—' : 'Skipped';
}

function limitText({ by, max, per }: Limit) {
  return by === undefined
    ? `${max} ${spans[per]}`
    : `${max} per ${by}, ${spans[per]}`;
}

function Live({ armed, id }: { armed: boolean; id: MomentId }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const fired = useDeferredValue(armed, false);
  const entry: Moment = moments[id];

  const { on } = useMoment<MomentId>(id, {
    anchor,
    subject: 'stage',
    when: entry.ms === undefined ? undefined : fired,
  });

  return (
    <>
      {entry.mark && (
        <LiveMark
          className='size-8'
          state={on && armed ? entry.mark : 'idle'}
        />
      )}
      <Chip ref={anchor} tone={on ? 'done' : 'neutral'}>
        {on ? 'On' : 'Off'}
      </Chip>
    </>
  );
}

function Row({ id }: { id: MomentId }) {
  const [run, setRun] = useState(0);
  const entry: Moment = moments[id];

  return (
    <tr className='border-b align-top last:border-b-0'>
      <td className='py-3 pr-4'>
        <code className='text-xs'>{id}</code>
        <p className='mt-1 max-w-sm text-muted-foreground'>{entry.use}</p>
      </td>
      <td className='py-3 pr-4 whitespace-nowrap'>
        {entry.budget?.map(limitText).join(' · ') ?? 'No limit'}
      </td>
      <td className='py-3 pr-4'>{entry.plain ?? quiets[entry.quiet]}</td>
      <td className='py-3 pr-4'>{reductions[entry.reduced]}</td>
      <td className='py-3 pr-4'>{hiddenText(entry)}</td>
      <td className='py-3 pr-4 whitespace-nowrap tabular-nums'>
        {entry.ms === undefined ? 'While it holds' : `${entry.ms} ms`}
      </td>
      <td className='py-3'>
        <div className='flex h-8 items-center justify-end gap-3'>
          <Live key={run} armed={run > 0} id={id} />
          <Button
            aria-label={`Replay ${id}`}
            onClick={() => {
              clearStored();
              setRun(run + 1);
            }}
            size='sm'
            variant='outline'
          >
            Replay
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function MomentsTable() {
  const queryClient = useQueryClient();
  const { data = defaultPreferences } = useQuery(preferencesQueryOptions);

  const quiet = useId();

  const ids = Object.keys(moments) as MomentId[];

  return (
    <div className='flex flex-col gap-2 text-sm'>
      <div className='flex items-center gap-2 self-end'>
        <Switch
          checked={data.personality === 'quiet'}
          id={quiet}
          onCheckedChange={(checked) =>
            queryClient.setQueryData(preferencesQueryOptions.queryKey, {
              ...data,
              personality: checked ? 'quiet' : 'default',
            })
          }
        />
        <Label htmlFor={quiet}>Quiet</Label>
      </div>
      <table className='w-full min-w-3xl text-left'>
        <thead>
          <tr className='border-b text-xs text-muted-foreground'>
            <th className='py-2 pr-4 font-medium' scope='col'>
              Moment
            </th>
            <th className='py-2 pr-4 font-medium' scope='col'>
              Budget
            </th>
            <th className='py-2 pr-4 font-medium' scope='col'>
              Quiet
            </th>
            <th className='py-2 pr-4 font-medium' scope='col'>
              Reduced motion
            </th>
            <th className='py-2 pr-4 font-medium' scope='col'>
              Hidden tab
            </th>
            <th className='py-2 pr-4 font-medium' scope='col'>
              Lasts
            </th>
            <th className='py-2 text-right font-medium' scope='col'>
              Stage
            </th>
          </tr>
        </thead>
        {Object.entries(tiers).map(([tier, fires]) => (
          <tbody key={tier}>
            <tr className='border-b'>
              <th
                className='pt-8 pb-2 font-normal'
                colSpan={7}
                scope='rowgroup'
              >
                <span className='text-base font-semibold capitalize'>
                  {tier}
                </span>
                <span className='ml-3 text-muted-foreground'>{fires}</span>
              </th>
            </tr>
            {ids
              .filter((id) => moments[id].tier === tier)
              .map((id) => (
                <Row key={id} id={id} />
              ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
