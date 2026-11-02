import type { Harness } from '@lab/harness';
import type { SessionId } from '@lab/protocol';

export class Agent<Snapshot> {
  constructor(private readonly harness: Harness<Snapshot>) {}

  start() {
    return this.harness.start();
  }

  createSession() {
    return this.harness.createSession();
  }

  readSession(sessionId: SessionId): Promise<Snapshot | undefined> {
    return this.harness.readSession(sessionId);
  }

  cancelSession(sessionId: SessionId) {
    return this.harness.cancelSession(sessionId);
  }
}
