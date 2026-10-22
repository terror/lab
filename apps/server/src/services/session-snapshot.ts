import type { SessionEntry, SessionSnapshot, SessionTask } from '@lab/shared';
import type * as Durable from 'durable-harness/pi-durable';

import { type Session, sessionMetadata } from './sessions';

export function sessionSnapshot(
  session: Session,
  snapshot: Durable.SessionSnapshot
): SessionSnapshot {
  return {
    sessionId: snapshot.sessionId,
    eventCount: snapshot.eventCount,
    unfinished: snapshot.unfinished,
    live: snapshot.live,
    entries: snapshot.entries as SessionEntry[],
    tasks: snapshot.tasks as SessionTask[],
    metadata: sessionMetadata(session),
  };
}
