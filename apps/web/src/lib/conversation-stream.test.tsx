import { FakeEventSource } from '@/test/helpers';
import { expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';

import { useConversation } from './conversation-stream';

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

test('a status that arrives after the run ends is dropped', async () => {
  vi.stubGlobal('EventSource', FakeEventSource);

  const { act, result, unmount } = await renderHook(() => useConversation(1));

  const source = FakeEventSource.current;

  await act(() => {
    source?.emit('value', { conversation: { id: 1 }, docs: {}, entries: [] });
    source?.emit('status', 'foo');
    source?.emit('ops', [['s', ['docs', 'pi.live'], { run: {} }]]);
  });

  await unmount();

  expect(result.current.status).toBe(undefined);
});

test('the stream stamps when each run was seen starting, when it last spoke and whether it is still connected', async ({
  onTestFinished,
}) => {
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.useFakeTimers({ toFake: ['Date'] });

  onTestFinished(() => {
    vi.useRealTimers();
  });

  vi.setSystemTime(1_000);

  const { act, result, unmount } = await renderHook(() => useConversation(1));

  const source = FakeEventSource.current;

  const pulses = [];

  for (const [type, data] of [
    [
      'value',
      {
        conversation: { id: 1 },
        docs: { 'pi.live': { run: {} } },
        entries: [],
      },
    ],
    ['ops', [['s', ['docs', 'pi.live'], { run: {}, tools: [] }]]],
    ['error', ''],
    ['ops', [['s', ['docs', 'pi.inbox'], { items: [] }]]],
    ['ops', [['s', ['docs', 'pi.live'], {}]]],
    ['ops', [['s', ['docs', 'pi.live'], { run: { inputs: [7] } }]]],
    ['ops', [['s', ['docs', 'pi.live'], { run: { inputs: [] } }]]],
    ['ops', [['s', ['docs', 'pi.live'], { run: { inputs: [8] } }]]],
  ] as const) {
    await act(() => source?.emit(type, data));

    pulses.push(result.current.pulse);

    vi.setSystemTime(Date.now() + 1_000);
  }

  await unmount();

  expect(pulses).toEqual([
    { at: 1_000, began: 1_000, fresh: false, open: true },
    { at: 2_000, began: 1_000, fresh: false, open: true },
    { at: 2_000, began: 1_000, fresh: false, open: false },
    { at: 2_000, began: 1_000, fresh: false, open: false },
    { at: 5_000, began: 5_000, fresh: true, open: true },
    { at: 6_000, began: 6_000, fresh: true, open: true },
    { at: 7_000, began: 6_000, fresh: true, open: true },
    { at: 8_000, began: 8_000, fresh: true, open: true },
  ]);
});
