import { expect, test } from 'vitest';
import { z } from 'zod';

import { readStored, setStorageUser, writeStored } from './storage';

test('one user never reads what another user kept in this browser', () => {
  setStorageUser('foo');
  writeStored('draft:new', 'bar');

  setStorageUser('baz');

  expect(readStored('draft:new', z.string(), '')).toBe('');
});

test('the first user to sign in clears what was kept for no one in particular', () => {
  window.localStorage.removeItem('lab:user');
  window.localStorage.setItem('lab:draft:new', '"foo"');
  window.localStorage.setItem('bar', '"baz"');
  window.sessionStorage.setItem('lab:foo:moments', '{}');

  setStorageUser('qux');

  expect([
    window.localStorage.getItem('lab:draft:new'),
    window.localStorage.getItem('bar'),
    window.sessionStorage.getItem('lab:foo:moments'),
  ]).toEqual([null, '"baz"', null]);
});

test('a borrowed storage user is handed back', () => {
  setStorageUser('foo');

  const restore = setStorageUser('bar');

  writeStored('baz', 'qux');
  restore();

  expect([
    readStored('baz', z.string(), ''),
    window.localStorage.getItem('lab:bar:baz'),
  ]).toEqual(['', '"qux"']);
});
