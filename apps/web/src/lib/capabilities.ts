import { queryOptions, useQuery } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import {
  AppWindow,
  CalendarClock,
  GitBranch,
  ImageIcon,
  ListChecks,
  type LucideIcon,
  Search,
  UsersRound,
} from 'lucide-react';

import { call, client } from './client';
import { useLedger } from './hints';

type Tried = InferResponseType<typeof client.capabilities.$get, 200>['tried'];

export type CapabilityId = keyof Tried | 'palette';

type Capability = {
  icon: LucideIcon;
  id: CapabilityId;
  label: string;
  prompt?: string;
  tip?: string;
};

const catalog: Capability[] = [
  {
    icon: AppWindow,
    id: 'apps',
    label: 'Make an app that remembers',
    prompt: 'Make me a tiny app that remembers …',
    tip: 'Ask for a tiny app that remembers things',
  },
  {
    icon: CalendarClock,
    id: 'schedules',
    label: 'Run something every morning',
    prompt: 'Every weekday at 8am, …',
    tip: 'Ask Lab to do something every morning',
  },
  {
    icon: ImageIcon,
    id: 'images',
    label: 'Draw something',
    prompt: 'Make an image of …',
    tip: 'Ask Lab to draw something',
  },
  {
    icon: UsersRound,
    id: 'helpers',
    label: 'Compare options side by side',
    prompt: 'Compare three options for … and have a helper research each',
    tip: 'Ask Lab to send helpers after a big question',
  },
  {
    icon: ListChecks,
    id: 'plan',
    label: 'Plan something with a checklist',
    prompt: 'Plan out … as a checklist and tick it off as you go',
    tip: 'Ask for a plan and Lab ticks it off as it goes',
  },
  { icon: GitBranch, id: 'branches', label: 'Try another answer' },
  {
    icon: Search,
    id: 'palette',
    label: 'Search everything',
    tip: 'Press ⌘K to search chats, files and settings',
  },
];

const capabilitiesQueryOptions = queryOptions({
  queryKey: ['capabilities'],
  queryFn: async ({ signal }) =>
    (await call(client.capabilities.$get(undefined, { init: { signal } })))
      .tried,
});

export function useCapabilities() {
  const { data } = useQuery(capabilitiesQueryOptions);
  const { loaded, seen } = useLedger();

  if (!data || !loaded) {
    return undefined;
  }

  const tried = { ...data, palette: seen.includes('palette') };

  return catalog.map((capability) => ({
    ...capability,
    tried: tried[capability.id],
  }));
}
