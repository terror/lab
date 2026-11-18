import { renderHookWithQuery, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { usePreference } from './preferences';

test('settings cached before a new one existed still apply while loading', async () => {
  window.localStorage.setItem(
    'lab:foo:preferences',
    JSON.stringify({ chatSort: 'title', lineNumbers: true, theme: 'dark' })
  );

  stubFetch(() => new Promise<Response>(() => {}));

  const { result } = await renderHookWithQuery(() => [
    usePreference('theme')[0],
    usePreference('personality')[0],
  ]);

  expect(result.current).toEqual(['dark', 'default']);
});
