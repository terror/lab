import { renderHookWithQuery, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import page from '../../index.html?raw';
import { usePreference } from './preferences';

test('the page paints with the theme saved in preferences', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { result } = await renderHookWithQuery(() => usePreference('theme'));

  await expect.poll(() => result.current[0]).toBe('dark');

  const script = document.createElement('script');

  script.textContent =
    new DOMParser().parseFromString(page, 'text/html').querySelector('script')
      ?.textContent ?? '';

  document.head.append(script);
  script.remove();

  expect(document.documentElement.className).toBe('dark');

  document.documentElement.className = '';
});
