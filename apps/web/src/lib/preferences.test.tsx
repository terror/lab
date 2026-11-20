import { renderHookWithQuery, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { usePreference } from './preferences';

test('settings cached before a new one existed still apply while loading', async () => {
  window.localStorage.setItem(
    'lab:foo:preferences',
    JSON.stringify({ lineNumbers: true, theme: 'dark' })
  );

  stubFetch(() => new Promise<Response>(() => {}));

  const { result } = await renderHookWithQuery(() => [
    usePreference('theme')[0],
    usePreference('chatSort')[0],
  ]);

  expect(result.current).toEqual(['dark', 'activity']);
});
