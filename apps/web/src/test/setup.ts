import { setStorageUser } from '@/lib/storage';
import { afterEach, beforeEach } from 'vitest';

beforeEach(() => {
  setStorageUser('foo');
});

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
