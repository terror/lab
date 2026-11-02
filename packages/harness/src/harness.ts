import type { SessionId } from '@lab/protocol';

export interface Harness<Snapshot = unknown> {
  start(): Promise<void>;

  createSession(): Promise<SessionId>;

  readSession(sessionId: SessionId): Promise<Snapshot | undefined>;

  cancelSession(sessionId: SessionId): Promise<void>;
}
