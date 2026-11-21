import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { type Op, applyImmutable } from '@earendil-works/chord/delta';
import {
  type ConversationView,
  type Cursor,
  type EntryRecord,
  type EntryQuery,
  type LiveState,
  type Page,
  type TranscriptView,
  ConversationTranscript,
} from '@earendil-works/pi-durable';
import type { Plan } from '@lab/server/schemas';
import { useCallback, useEffect, useRef, useState } from 'react';

import { call, client } from './client';
import type { Gap } from './transcript';

function entriesRequest(
  id: number,
  agent: number | undefined,
  query: Record<string, string | undefined>
) {
  if (agent === undefined) {
    return client.conversations[':id'].entries.$get({
      param: { id: String(id) },
      query,
    });
  }

  return client.conversations[':id'].subagents[':agentId'].entries.$get({
    param: { agentId: String(agent), id: String(id) },
    query,
  });
}

function eventsUrl(id: number, agent: number | undefined) {
  if (agent === undefined) {
    return client.conversations[':id'].events.$url({
      param: { id: String(id) },
    });
  }

  return client.conversations[':id'].subagents[':agentId'].events.$url({
    param: { agentId: String(agent), id: String(id) },
  });
}

async function loadEntries(
  id: number,
  agent: number | undefined,
  { maxEntryId, minEntryId, order }: Omit<EntryQuery, 'conversationId'>,
  limit: number
) {
  const page = await call(
    entriesRequest(id, agent, {
      limit: String(limit),
      maxEntryId: maxEntryId?.toString(),
      minEntryId: minEntryId?.toString(),
      order,
    })
  );

  return page as unknown as Page<EntryRecord, Cursor>;
}

type Pulse = { at: number; began: number; fresh: boolean; open: boolean };

export function useConversation(id: number, agent?: number) {
  const [view, setView] = useState<TranscriptView>();
  const [status, setStatus] = useState<string>();
  const [plan, setPlan] = useState<Plan>();
  const [pulse, setPulse] = useState<Pulse>(() => ({
    at: Date.now(),
    began: Date.now(),
    fresh: false,
    open: true,
  }));
  const transcript = useRef<ConversationTranscript>(undefined);

  useEffect(() => {
    const current = new ConversationTranscript((query, limit) =>
      loadEntries(id, agent, query, limit)
    );

    transcript.current = current;

    const source = new EventSource(eventsUrl(id, agent));

    let base: ConversationView | undefined;

    let run: {
      began: number;
      fresh: boolean;
      id?: number | string;
      running: boolean;
    } = { began: Date.now(), fresh: false, running: false };

    const live = () => base?.docs['pi.live'] as LiveState | undefined;

    const beat = (fresh: boolean) => {
      const at = Date.now();

      const started = live()?.run;

      const input = started?.inputs?.[0];

      const next =
        input !== undefined && run.id !== undefined && input !== run.id;

      if ((started !== undefined) !== run.running || next) {
        run = { began: at, fresh, id: input, running: started !== undefined };
      }

      run.id ??= input;

      setPulse({ at, began: run.began, fresh: run.fresh, open: true });
    };

    source.addEventListener('error', () => {
      setPulse((last) => ({ ...last, open: false }));
    });

    source.addEventListener('value', (event) => {
      base = JSON.parse(event.data);
      setView(base && current.merge(base));
      beat(false);
    });

    source.addEventListener('ops', (event) => {
      if (base) {
        const before = live();

        base = applyImmutable(base, JSON.parse(event.data) as Op[]);
        setView(current.merge(base));

        if (live() !== before) {
          beat(true);
        }

        if (!live()?.run) {
          setStatus(undefined);
        }
      }
    });

    source.addEventListener('status', (event) => {
      if (live()?.run) {
        setStatus(event.data);
        beat(true);
      }
    });

    source.addEventListener('plan', (event) => {
      setPlan(JSON.parse(event.data));
    });

    return () => source.close();
  }, [agent, id]);

  const loadEarlier = useCallback(async () => {
    if (transcript.current) {
      setView(await transcript.current.loadEarlier(BACKGROUND_CONTEXT));
    }
  }, []);

  const fillGap = useCallback(async (gap: Gap) => {
    if (transcript.current) {
      setView(await transcript.current.fillGap(gap, BACKGROUND_CONTEXT));
    }
  }, []);

  return { view, status, plan, pulse, loadEarlier, fillGap };
}
