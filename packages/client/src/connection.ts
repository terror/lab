import {
  ChordError,
  type Ctx,
  createHost,
  isChordError,
  type Link,
  type Ref,
  webSocketLink,
} from "@earendil-works/chord";
import { LabService } from "@lab/wire";
import type { ConversationClient } from "./conversation";
import { clientError, Store } from "./store";

export type ConnectionState = {
  readonly status:
    | "disconnected"
    | "connecting"
    | "connected"
    | "reconnecting"
    | "unauthorized"
    | "incompatible";
  readonly error?: Error;
  readonly retryAt?: number;
};

type Connecting = {
  readonly status: "connecting";
  readonly attempt: ConnectionAttempt;
  readonly attempts: number;
};

type Connected = {
  readonly status: "connected";
  readonly attempt: ConnectionAttempt;
  readonly attempts: number;
  readonly link: Link;
  readonly service: Ref<typeof LabService>;
  readonly connectedAt: number;
};

type Waiting = {
  readonly status: "waiting-to-retry";
  readonly attempts: number;
  readonly error: Error;
  readonly retryAt: number;
  readonly retry: ReturnType<typeof setTimeout>;
};

type Blocked = {
  readonly status: "blocked";
  readonly reason: "unauthorized" | "incompatible";
  readonly error: Error;
};

type State =
  | { readonly status: "disconnected"; readonly error?: Error }
  | Connecting
  | Connected
  | Waiting
  | Blocked;

class ConnectionAttempt {
  private readonly cleanups: ((reason?: string) => void)[] = [];

  readonly controller = new AbortController();

  readonly host = createHost({
    kind: "client",
    self: "browser",
    readyTimeout: 15_000,
  });

  addCleanup(cleanup: (reason?: string) => void) {
    if (this.controller.signal.aborted) {
      cleanup();
    } else {
      this.cleanups.push(cleanup);
    }
  }

  async close(reason?: string) {
    if (this.controller.signal.aborted) {
      return;
    }

    this.controller.abort();

    const results = await Promise.allSettled([
      ...this.cleanups
        .splice(0)
        .reverse()
        .map(async (cleanup) => cleanup(reason)),
      this.host.close(),
    ]);

    const errors = results
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);

    if (errors.length > 0) {
      throw new AggregateError(errors, "Unable to close the connection.");
    }
  }
}

export class Connection {
  private current: State = { status: "disconnected" };
  private owners = 0;

  private readonly snapshots = new Store(snapshot(this.current));
  private readonly conversations = new Set<ConversationClient>();
  private readonly conversationChanges = new Store(0);

  constructor(private readonly onUnauthorized?: () => void) {}

  readonly getSnapshot = this.snapshots.getSnapshot;
  readonly subscribe = this.snapshots.subscribe;
  readonly subscribeConversations = this.conversationChanges.subscribe;

  readonly connect = () => {
    this.owners += 1;

    if (this.owners === 1) {
      this.start(0);
    }

    let active = true;

    return () => {
      if (!active) {
        return;
      }

      active = false;

      this.owners -= 1;

      if (this.owners === 0) {
        this.transition({ status: "disconnected" });
      }
    };
  };

  watch(conversation: ConversationClient) {
    this.conversations.add(conversation);

    if (this.current.status === "connected") {
      this.attach(conversation, this.current);
    }

    return () => {
      this.conversations.delete(conversation);
      conversation.detach();
    };
  }

  async call<T>(
    operation: (context: Ctx) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    const current = this.current;

    if (current.status !== "connected") {
      throw new ChordError("unavailable", "lab is not connected.");
    }

    const { attempt } = current;

    try {
      return await attempt.host.root(operation, {
        signal: AbortSignal.any([
          attempt.controller.signal,
          AbortSignal.timeout(30_000),
          ...(signal === undefined ? [] : [signal]),
        ]),
      });
    } catch (error) {
      this.referenceFailed(attempt, error);
      throw error;
    }
  }

  private active(attempt: ConnectionAttempt) {
    const current = this.current;

    return (current.status === "connecting" ||
      current.status === "connected") &&
      current.attempt === attempt
      ? current
      : undefined;
  }

  private attach(conversation: ConversationClient, current: Connected) {
    conversation.attach(current.attempt.host, (error) =>
      this.referenceFailed(current.attempt, error),
    );
  }

  private referenceFailed(attempt: ConnectionAttempt, error: unknown) {
    if (
      isChordError(error, "contract_mismatch") ||
      isChordError(error, "upgrade_required") ||
      isChordError(error, "forbidden") ||
      isChordError(error, "unavailable") ||
      isChordError(error, "superseded") ||
      isChordError(error, "upgrade_conflict")
    ) {
      this.failed(attempt, clientError(error));
    }
  }

  private start(attempts: number) {
    const current: Connecting = {
      status: "connecting",
      attempt: new ConnectionAttempt(),
      attempts,
    };

    this.transition(current);

    if (this.current === current) {
      void this.open(current);
    }
  }

  private async open(current: Connecting) {
    const { attempt } = current;

    try {
      const response = await fetch("/auth/session", {
        credentials: "same-origin",
        cache: "no-store",
        headers: { "X-Lab-Request": "1" },
        signal: AbortSignal.any([
          attempt.controller.signal,
          AbortSignal.timeout(15_000),
        ]),
      });

      if (this.current !== current) {
        return;
      }

      if (response.status === 401 || response.status === 403) {
        this.block(attempt, "unauthorized", new Error("Sign in to reconnect."));
        return;
      }

      if (response.status !== 204) {
        throw new Error("Unable to reach your session.");
      }

      const url = new URL("/chord", location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

      const socket = new WebSocket(url);

      socket.binaryType = "arraybuffer";

      const link = webSocketLink({
        get readyState() {
          return socket.readyState;
        },
        send(data) {
          socket.send(typeof data === "string" ? data : new Uint8Array(data));
        },
        close: (code, reason) => socket.close(code, reason),
        addEventListener: socket.addEventListener.bind(socket),
      });

      attempt.addCleanup((reason) => link.close(reason));

      const timeout = setTimeout(
        () => this.failed(attempt, new Error("Connection timed out")),
        15_000,
      );

      attempt.addCleanup(() => clearTimeout(timeout));

      attempt.host.connect(link, {
        principal: "server",
        onProtocolMismatch: () =>
          this.block(
            attempt,
            "incompatible",
            new Error("lab was updated. Reload this page to reconnect."),
          ),
      });

      link.onClose((reason) => this.failed(attempt, new Error(reason)));

      if (this.current !== current) {
        return;
      }

      const service = attempt.host.hold(LabService, {});

      attempt.addCleanup(() => service.release());

      const update = () => {
        const active = this.active(attempt);

        if (active === undefined) {
          return;
        }

        if (service.status === "live") {
          if (active.status === "connecting") {
            clearTimeout(timeout);

            this.transition({
              ...active,
              status: "connected",
              link,
              service,
              connectedAt: Date.now(),
            });

            if (this.active(attempt)?.status === "connected") {
              attempt.addCleanup(
                service.conversations.subscribe(() => {
                  if (
                    this.active(attempt)?.status === "connected" &&
                    service.status === "live"
                  ) {
                    this.conversationChanges.set(
                      this.conversationChanges.getSnapshot() + 1,
                    );
                  }
                }),
              );
            }
          }
        } else if (service.status === "gone") {
          this.failed(attempt, clientError(service.error));
        } else if (active.status === "connected" && !link.closed) {
          this.failed(attempt, new Error("Connection is no longer available."));
        }
      };

      attempt.addCleanup(service.onStatus(update));

      update();
    } catch (error) {
      this.failed(attempt, clientError(error));
    }
  }

  private failed(attempt: ConnectionAttempt, error: Error) {
    const current = this.active(attempt);

    if (current === undefined) {
      return;
    }

    if (
      isChordError(error, "contract_mismatch") ||
      isChordError(error, "upgrade_required")
    ) {
      this.block(attempt, "incompatible", error);
      return;
    }

    const attempts =
      current.status === "connected" &&
      Date.now() - current.connectedAt >= 30_000
        ? 0
        : current.attempts;

    const delay =
      Math.min(30_000, 500 * 2 ** Math.min(attempts, 6)) *
      (0.5 + Math.random() * 0.5);

    const waiting: Waiting = {
      status: "waiting-to-retry",
      attempts: Math.min(attempts + 1, 6),
      error,
      retryAt: Date.now() + delay,
      retry: setTimeout(() => {
        if (this.current === waiting) {
          this.start(waiting.attempts);
        }
      }, delay),
    };

    this.transition(waiting);
  }

  private block(
    attempt: ConnectionAttempt,
    reason: Blocked["reason"],
    error: Error,
  ) {
    if (this.active(attempt) === undefined) {
      return;
    }

    const blocked: Blocked = { status: "blocked", reason, error };

    this.transition(blocked);

    if (this.current === blocked && reason === "unauthorized") {
      this.onUnauthorized?.();
    }
  }

  private transition(next: State) {
    const previous = this.current;

    this.current = next;

    if (previous.status === "waiting-to-retry") {
      clearTimeout(previous.retry);
    }

    if (
      (previous.status === "connecting" || previous.status === "connected") &&
      ((next.status !== "connecting" && next.status !== "connected") ||
        previous.attempt !== next.attempt)
    ) {
      for (const conversation of this.conversations) {
        conversation.detach();
      }

      const reason =
        next.status === "waiting-to-retry" || next.status === "blocked"
          ? next.error.message
          : undefined;

      void previous.attempt.close(reason).catch((error) => {
        if (this.current === next && next.status === "disconnected") {
          this.transition({
            status: "disconnected",
            error: clientError(error),
          });
        }
      });
    }

    if (this.current !== next) {
      return;
    }

    this.snapshots.set(snapshot(next));

    if (next.status === "connected") {
      for (const conversation of this.conversations) {
        if (this.current !== next) {
          break;
        }

        this.attach(conversation, next);
      }
    }
  }
}

function snapshot(state: State): ConnectionState {
  switch (state.status) {
    case "disconnected":
      return state;
    case "connecting":
      return { status: state.attempts === 0 ? "connecting" : "reconnecting" };
    case "connected":
      return { status: "connected" };
    case "waiting-to-retry":
      return {
        status: "reconnecting",
        error: state.error,
        retryAt: state.retryAt,
      };
    case "blocked":
      return { status: state.reason, error: state.error };
  }
}
