const LIMIT = 20;

const open = new Map<string, Set<AbortController>>();

let accepting = false;

export function startStreams() {
  accepting = true;
}

export function closeStreams() {
  accepting = false;

  for (const streams of open.values()) {
    for (const stream of streams) {
      stream.abort();
    }
  }
}

export function openStream(userId: string) {
  const stream = new AbortController();

  if (!accepting) {
    stream.abort();
    return stream;
  }

  const streams = open.get(userId) ?? new Set<AbortController>();

  open.set(userId, streams.add(stream));

  stream.signal.addEventListener(
    'abort',
    () => {
      streams.delete(stream);

      if (streams.size === 0) {
        open.delete(userId);
      }
    },
    { once: true }
  );

  for (const oldest of [...streams].slice(0, -LIMIT)) {
    oldest.abort();
  }

  return stream;
}
