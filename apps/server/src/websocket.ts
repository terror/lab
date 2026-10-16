import {
  type Host,
  type WebSocketLike,
  webSocketLink,
} from "@earendil-works/chord";
import type { ServerWebSocket, WebSocketHandler } from "bun";
import type { BrowserPrincipal, Principal, Sessions } from "./auth";

type SocketData = { principal: BrowserPrincipal; adapter?: BunWebSocket };
type SocketEvent = "open" | "message" | "close" | "error";
type SocketListener = (event: { readonly data: unknown }) => void;

class BunWebSocket implements WebSocketLike {
  private closed = false;

  private readonly listeners = new Map<SocketEvent, Set<SocketListener>>();

  constructor(private readonly socket: ServerWebSocket<SocketData>) {}

  get readyState() {
    return this.closed ? 3 : this.socket.readyState;
  }

  addEventListener(type: SocketEvent, listener: SocketListener) {
    const listeners = this.listeners.get(type) ?? new Set<SocketListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  send(data: string | Uint8Array) {
    if (!this.closed && this.socket.send(data) === 0) {
      this.close(1011, "WebSocket send failed");
    }
  }

  close(code?: number, reason?: string) {
    if (this.closed) {
      return;
    }

    this.socket.close(code, reason);

    this.end();
  }

  message(data: unknown) {
    if (!this.closed) {
      for (const listener of this.listeners.get("message") ?? []) {
        listener({ data });
      }
    }
  }

  end() {
    if (this.closed) {
      return;
    }

    this.closed = true;

    const listeners = this.listeners.get("close");

    this.listeners.clear();

    for (const listener of listeners ?? []) {
      listener({ data: undefined });
    }
  }
}

export function webSockets(
  host: Host<Principal>,
  sessions: Sessions,
): WebSocketHandler<SocketData> {
  return {
    data: {} as SocketData,
    maxPayloadLength: 1024 * 1024,
    backpressureLimit: 4 * 1024 * 1024,
    closeOnBackpressureLimit: true,
    open(socket) {
      if (!sessions.active(socket.data.principal)) {
        socket.close(1008, "Session expired or revoked");
        return;
      }

      const adapter = new BunWebSocket(socket);

      socket.data.adapter = adapter;

      host.accept(
        webSocketLink(adapter, { compress: true, acceptPacked: false }),
        { principal: socket.data.principal, kind: "client", maxCalls: 64 },
      );
    },
    message(socket, message) {
      if (!sessions.active(socket.data.principal)) {
        socket.data.adapter?.close(1008, "Session expired or revoked");
        return;
      }

      socket.data.adapter?.message(message);
    },
    close(socket) {
      socket.data.adapter?.end();
    },
  };
}
