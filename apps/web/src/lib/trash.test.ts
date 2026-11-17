import { stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { emptyTrash } from './trash';

test('emptying the trash forgets drafts of purged chats', async () => {
  stubFetch(() => Response.json({ chats: [1] }));

  window.localStorage.setItem('lab:draft:1', '"foo"');
  window.localStorage.setItem('lab:draft:2', '"bar"');

  await emptyTrash();

  expect([
    window.localStorage.getItem('lab:draft:1'),
    window.localStorage.getItem('lab:draft:2'),
  ]).toEqual([null, '"bar"']);
});
