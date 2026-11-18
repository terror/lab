import { expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';

import { useConversation } from './conversation-stream';

type Listener = (event: { data: string }) => void;

class FakeEventSource {
  static current: FakeEventSource | undefined;

  closed = false;
  listeners = new Map<string, Listener>();
  url: string | URL;

  constructor(url: string | URL) {
    this.url = url;
    FakeEventSource.current = this;
  }

  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data: unknown) {
    this.listeners.get(type)?.({
      data: typeof data === 'string' ? data : JSON.stringify(data),
    });
  }
}

test('the conversation follows its event stream', async () => {
  vi.stubGlobal('EventSource', FakeEventSource);

  const { act, result, unmount } = await renderHook(() => useConversation(1));

  const source = FakeEventSource.current;

  const entry = {
    conversationId: 1,
    data: { text: 'foo' },
    id: 2,
    kind: 'lab.message',
  };

  await act(() => {
    source?.emit('value', {
      conversation: { id: 1 },
      docs: {},
      entries: [entry],
    });
    source?.emit('ops', [['s', ['docs', 'pi.live'], { run: {} }]]);
    source?.emit('status', 'bar');
  });

  const running = {
    live: result.current.view?.docs['pi.live'],
    status: result.current.status,
  };

  await act(() => {
    source?.emit('ops', [['s', ['docs', 'pi.live'], {}]]);
  });

  await unmount();

  expect({
    items: result.current.view?.items.map((item) =>
      item.kind === 'entry' ? item.entry.id : item.kind
    ),
    running,
    source: { closed: source?.closed, url: String(source?.url) },
    status: result.current.status,
  }).toEqual({
    items: [2],
    running: { live: { run: {} }, status: 'bar' },
    source: {
      closed: true,
      url: `${window.location.origin}/api/conversations/1/events`,
    },
    status: undefined,
  });
});
