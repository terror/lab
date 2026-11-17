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
    ])
  ).toEqual([
    { id: 1, role: 'user', text: 'foo' },
    { id: 2, role: 'assistant', text: 'bar\n\nbaz' },
  ]);
});
