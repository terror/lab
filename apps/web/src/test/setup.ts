import { setStorageUser } from '@/lib/storage';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { cleanup } from 'vitest-browser-react';

const unexpected: string[] = [];

beforeEach(() => {
  setStorageUser('foo');
  unexpected.length = 0;

  vi.stubGlobal(
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const method =
        init?.method ?? (input instanceof Request ? input.method : 'GET');
      const url = input instanceof Request ? input.url : input.toString();
      const request = `${method} ${url}`;

      unexpected.push(request);

      throw new Error(`Unexpected request: ${request}`);
    }
  );
});

afterEach(async () => {
  await cleanup();

  window.localStorage.clear();
  window.sessionStorage.clear();

  expect(unexpected).toEqual([]);
});
