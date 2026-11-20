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

type Limits<Id extends MomentId> =
  Entry<Id> extends { budget: readonly (infer Limit)[] } ? Limit : never;

type Requested = {
  [Id in MomentId]: Entry<Id> extends
    | { budget: readonly unknown[] }
    | { ms: number }
    ? Id
    : never;
}[MomentId];

type Subjected = {
  [Id in MomentId]: [Extract<Limits<Id>, { by: string }>] extends [never]
    ? never
    : Id;
}[MomentId];

type Anchored = {
  [Id in MomentId]: Entry<Id> extends { effect: string } ? Id : never;
}[MomentId];

type Options<Id extends MomentId> = ([Extract<Id, Requested>] extends [never]
  ? { when?: never }
  : { when?: boolean }) &
  ([Extract<Id, Subjected>] extends [never]
    ? { subject?: never }
    : { subject: Subject | undefined }) &
  ([Extract<Id, Anchored>] extends [never]
    ? { anchor?: never }
    : { anchor: Anchor });

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
  confetti: (anchor: Element) => void confetti(anchor),
} satisfies Record<NonNullable<Moment['effect']>, (anchor: Element) => void>;

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
  const entry: Moment = moments[id];
  const budget = [...(entry.budget ?? [])];
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

  const kept = {
    device: new Map<string, { from: number; max: number }>(),
    tab: new Map<string, { from: number; max: number }>(),
  };

  for (const { from, home, key, max } of counted) {
    const wider = kept[home].get(key) ?? { from, max };

    kept[home].set(key, {
      from: Math.min(from, wider.from),
      max: Math.max(max, wider.max),
    });
  }

  const written = [...new Set(counted.map((limit) => limit.home))].map(
    (home) => {
      const ledger = ledgers[home];

      for (const [key, { from, max }] of kept[home]) {
        ledger[key] = [
          ...(ledger[key] ?? []).filter((at) => at >= from),
          now,
        ].slice(-max);
      }

      return { home, ledger: bounded(ledger) };
    }
  );

  try {
    for (const { home, ledger } of written) {
      writeStored('moments', ledger, home);
    }
  } catch {
    return undefined;
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

  const eligible =
    moment !== undefined && !(subjected && subject === undefined);

  const ready = fine && eligible;

  const [scope, setScope] = useState({ id, ready, subject });

  if (scope.id !== id || scope.ready !== ready || scope.subject !== subject) {
    setScope({ id, ready, subject });
    setState(rest);
  }

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
    const { effect }: Partial<Moment> = current.id ? moments[current.id] : {};
    const target = current.anchor?.current;

    const order =
      current.ready && current.id !== undefined && !(effect && !target)
        ? spend(current.id, current.subject)
        : undefined;

    if (order === undefined) {
      setState((held) => (held.phase === 'pending' ? rest : held));

      return false;
    }

    if (effect && target) {
      effects[effect](target);
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
    const cue = cued && eligible ? (subject ?? true) : false;

    if (cue === false || cue === asked.current) {
      return;
    }

    asked.current = cue;
    request();
  }, [cued, eligible, request, subject]);

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
