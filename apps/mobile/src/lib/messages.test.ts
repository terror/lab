import { expect, test } from 'bun:test';

import { messages } from './messages';

test('messages', () => {
  expect(
    messages([
      { id: 1, kind: 'pi.user', model: [{ content: 'foo' }] },
      {
        id: 2,
        kind: 'pi.assistant',
        model: [
          {
            content: [
              { type: 'thinking' },
              { type: 'text', text: 'bar' },
              { type: 'toolCall' },
              { type: 'text', text: 'baz' },
            ],
          },
        ],
      },
      { id: 3, kind: 'pi.compaction', model: [{ content: 'qux' }] },
      { id: 4, kind: 'pi.assistant', model: [{ content: [] }] },
      { id: 5, kind: 'pi.reset' },
      {
        data: { files: [], text: 'quux' },
        id: 6,
        kind: 'lab.message',
        model: [{ content: [{ type: 'text', text: 'quux\n\ncorge' }] }],
      },
    ])
  ).toEqual([
    { id: 1, role: 'user', text: 'foo' },
    { id: 2, role: 'assistant', text: 'bar\n\nbaz' },
    { id: 6, role: 'user', text: 'quux' },
  ]);
});
