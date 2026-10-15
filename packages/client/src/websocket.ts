import { webSocketLink } from "@earendil-works/chord";

export function browserLink(url: URL) {
  const socket = new WebSocket(url);
  socket.binaryType = "arraybuffer";

  return webSocketLink({
    get readyState() {
      return socket.readyState;
    },
    send(data) {
      socket.send(typeof data === "string" ? data : new Uint8Array(data));
    },
    close: (code, reason) => socket.close(code, reason),
    addEventListener: socket.addEventListener.bind(socket),
  });
}
