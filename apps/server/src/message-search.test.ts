import { expect, test } from 'bun:test';

import { plain } from './message-search';

function strips(text: string, expected: string) {
  expect(plain(text)).toBe(expected);
}

test('plain text drops emphasis, headings, list and task markers, and link targets', () => {
  strips('**foo** __bar__ `baz`', 'foo bar baz');
  strips('# foo\n## bar', 'foo\nbar');
  strips('- foo\n* bar\n1. baz', 'foo\nbar\nbaz');
  strips('- [ ] foo\n- [x] bar', 'foo\nbar');
  strips('[foo](https://bar.test) baz', 'foo baz');
});
