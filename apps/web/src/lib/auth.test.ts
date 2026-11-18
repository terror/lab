import { stubFetch } from '@/test/helpers';
import { QueryClient } from '@tanstack/react-query';
import { expect, test } from 'vitest';

import { signOut } from './auth';

test('signing out forgets what this browser kept for the account', async () => {
  stubFetch(() => Response.json({ success: true }));

  window.localStorage.setItem('lab:foo:draft:new', '"foo"');
  window.localStorage.setItem('bar', '"baz"');

  await signOut(new QueryClient());

  expect([
    window.localStorage.getItem('lab:foo:draft:new'),
    window.localStorage.getItem('bar'),
  ]).toEqual([null, '"baz"']);
});

test('a failed sign-out keeps what this browser kept for the account', async () => {
  stubFetch(() => new Response(null, { status: 500 }));

  window.localStorage.setItem('lab:foo:draft:new', '"bar"');

  await expect(signOut(new QueryClient())).rejects.toThrow(
    'Couldn’t sign out. Check your connection and try again.'
  );

  expect(window.localStorage.getItem('lab:foo:draft:new')).toBe('"bar"');
});
