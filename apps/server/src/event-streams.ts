const LIMIT = 20;

const open = new Map<string, Set<AbortController>>();

export function openStream(userId: string) {
  const streams = open.get(userId) ?? new Set<AbortController>();

  const stream = new AbortController();

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
