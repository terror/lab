import { useQuery } from '@tanstack/react-query';
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { z } from 'zod';

import { confetti } from './confetti';
import { useMediaQuery } from './media';
import { type Moment, type MomentId, moments } from './moments';
import { stagger } from './motion';
import { type Preferences, preferencesQueryOptions } from './preferences';
import { readStored, writeStored } from './storage';

type Entry<Id extends MomentId> = (typeof moments)[Id];

type Subject = number | string;

type Anchor = RefObject<Element | null>;

type Requested = {
  [Id in MomentId]: Entry<Id> extends
    | { budget: readonly unknown[] }
    | { ms: number }
    ? Id
    : never;
}[MomentId];

type Subjected = {
  [Id in MomentId]: Entry<Id> extends { budget: readonly (infer Limit)[] }
    ? Limit extends { by: string }
      ? Id
      : never
    : never;
}[MomentId];

type Anchored = {
  [Id in MomentId]: Entry<Id> extends { effect: string } ? Id : never;
}[MomentId];

type Options<Id extends MomentId> = (Id extends Requested
  ? { when?: boolean }
  : { when?: never }) &
  (Id extends Subjected
    ? { subject: Subject | undefined }
    : { subject?: never }) &
  (Id extends Anchored ? { anchor: Anchor } : { anchor?: never });

type Args<Id extends MomentId> =
  Partial<Options<Id>> extends Options<Id>
    ? [options?: Options<Id>]
    : [options: Options<Id>];

type Handle<Id extends MomentId> = {
  on: boolean;
  order: number;
} & (Entry<Id> extends {
  mark: infer Mark;
}
  ? { mark: Mark | undefined }
  : unknown) &
  (Entry<Id> extends { ms: number } ? { play: () => boolean } : unknown);

type State =
  | { order: number; phase: 'on' }
  | { phase: 'pending' }
  | { phase: 'rest' };

const rest: State = { phase: 'rest' };

const pending: State = { phase: 'pending' };

const SUBJECTS = 50;

const ledgerSchema = z.record(z.string(), z.array(z.number()));

type Ledger = z.infer<typeof ledgerSchema>;

const homes = { day: 'device', ever: 'device', session: 'tab' } as const;

const ticks = new Map<MomentId, number>();

const waiting = new Set<() => void>();

const effects = {
  confetti: (anchor: Element | null) => {
    if (anchor) {
      void confetti(anchor);
    }
  },
} satisfies Record<
  NonNullable<Moment['effect']>,
  (anchor: Element | null) => void
>;

function since(per: keyof typeof homes, now: number) {
  return per === 'ever' ? 0 : new Date(now).setHours(0, 0, 0, 0);
}

function bounded(ledger: Ledger) {
  const subjects = new Map<string, number>();
  const kept: Ledger = {};

  const newest = Object.entries(ledger).toSorted(
    ([, first], [, second]) => (second.at(-1) ?? 0) - (first.at(-1) ?? 0)
  );

  for (const [key, stamps] of newest) {
    const slash = key.indexOf('/');
    const id = slash === -1 ? key : key.slice(0, slash);
    const count = subjects.get(id) ?? 0;

    if (Object.hasOwn(moments, id) && (slash === -1 || count < SUBJECTS)) {
      subjects.set(id, slash === -1 ? count : count + 1);
      kept[key] = stamps;
    }
  }

  return kept;
}

function spend(id: MomentId, subject: Subject | undefined) {
  const { budget = [] }: Moment = moments[id];
  const now = Date.now();
  const order = ticks.get(id) ?? 0;

  const ledgers = {
    device: readStored('moments', ledgerSchema, {}),
    tab: readStored('moments', ledgerSchema, {}, 'tab'),
  };

  const burst = budget.find(({ per }) => per === 'tick');

  const counted = budget.flatMap(({ by, max, per }) => {
    if (per === 'tick') {
      return [];
    }

    const key = by === undefined ? id : `${id}/${subject}`;

    return [{ from: since(per, now), home: homes[per], key, max }];
  });

  const full =
    (burst !== undefined && order >= burst.max) ||
    counted.some(
      ({ from, home, key, max }) =>
        (ledgers[home][key] ?? []).filter((at) => at >= from).length >= max
    );

  if (full) {
    return undefined;
  }

  for (const home of new Set(counted.map((limit) => limit.home))) {
    const ledger = ledgers[home];

    const keyed = Object.groupBy(
      counted.filter((limit) => limit.home === home),
      ({ key }) => key
    );

    for (const [key, limits = []] of Object.entries(keyed)) {
      const from = Math.min(...limits.map((limit) => limit.from));
      const most = Math.max(...limits.map((limit) => limit.max));

      ledger[key] = [
        ...(ledger[key] ?? []).filter((at) => at >= from),
        now,
      ].slice(-most);
    }

    writeStored('moments', bounded(ledger), home);
  }

  if (burst) {
    if (order === 0) {
      queueMicrotask(() => ticks.delete(id));
    }

    ticks.set(id, order + 1);
  }

  return order;
}

function release() {
  if (document.visibilityState !== 'visible') {
    return;
  }

  for (const start of waiting) {
    start();
  }
}

function wait(start: () => void) {
  if (waiting.size === 0) {
    document.addEventListener('visibilitychange', release);
  }

  waiting.add(start);

  return () => {
    waiting.delete(start);

    if (waiting.size === 0) {
      document.removeEventListener('visibilitychange', release);
    }
  };
}

function quietOf({ personality }: Preferences) {
  return personality === 'quiet';
}

function useQuiet() {
  return (
    useQuery({ ...preferencesQueryOptions, select: quietOf }).data ?? false
  );
}

export function useMoment<Id extends MomentId>(
  id: Id | undefined,
  ...[options]: Args<Id>
): Handle<Id> {
  const moment: Moment | undefined = id && moments[id];
  const quiet = useQuiet();
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [state, setState] = useState(rest);

  const {
    anchor,
    subject,
    when,
  }: { anchor?: Anchor; subject?: Subject; when?: boolean } = options ?? {};

  const fine =
    moment !== undefined &&
    !(quiet && moment.quiet !== 'keep') &&
    !(reduced && moment.reduced === 'skip');

  const subjected = moment?.budget?.some(({ by }) => by !== undefined) ?? false;

  const ready = fine && !(subjected && subject === undefined);

  const shot = moment?.ms !== undefined;

  const budgeted = moment?.budget !== undefined;

  const cued = budgeted && !shot && when === undefined;

  const live = useRef({ anchor, id, ready, subject });

  const asked = useRef<Subject | boolean>(false);

  const was = useRef(when);

  useLayoutEffect(() => {
    live.current = { anchor, id, ready, subject };
  });

  const start = useCallback(() => {
    const current = live.current;

    const order =
      current.ready && current.id !== undefined
        ? spend(current.id, current.subject)
        : undefined;

    if (order === undefined || current.id === undefined) {
      setState(rest);

      return false;
    }

    const { effect }: Moment = moments[current.id];

    if (effect) {
      effects[effect](current.anchor?.current ?? null);
    }

    setState({ order, phase: 'on' });

    return true;
  }, []);

  const request = useCallback(() => {
    const current = live.current;

    if (!current.ready || current.id === undefined) {
      return false;
    }

    if (document.visibilityState === 'visible') {
      return start();
    }

    const { hidden }: Moment = moments[current.id];

    if (hidden === 'wait') {
      setState(pending);
    }

    return false;
  }, [start]);

  useLayoutEffect(() => {
    const cue = cued && ready ? (subject ?? true) : false;

    if (cue === false || cue === asked.current) {
      return;
    }

    asked.current = cue;
    request();
  }, [cued, ready, request, subject]);

  useLayoutEffect(() => {
    const before = was.current === true;

    was.current = when;

    if (when === true && !before) {
      request();
    }

    if (when !== true && before) {
      setState((current) => (shot && current.phase === 'on' ? current : rest));
    }
  }, [request, shot, when]);

  useEffect(() => {
    if (state.phase !== 'pending') {
      return undefined;
    }

    if (document.visibilityState === 'visible') {
      start();

      return undefined;
    }

    return wait(start);
  }, [start, state.phase]);

  const ms = moment?.ms;

  useEffect(() => {
    if (state.phase !== 'on' || ms === undefined) {
      return undefined;
    }

    const timer = window.setTimeout(
      () => setState(rest),
      ms + state.order * stagger * 1_000
    );

    return () => window.clearTimeout(timer);
  }, [ms, state]);

  const on = ready && ((!shot && !budgeted) || state.phase === 'on');

  return {
    mark: on ? moment?.mark : undefined,
    on,
    order: state.phase === 'on' ? state.order : 0,
    play: request,
  } as unknown as Handle<Id>;
}
