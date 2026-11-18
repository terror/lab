import { renderHookWithQuery, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import page from '../../index.html?raw';
import { useStoredPreferences } from './preferences';

function paint() {
  const script = document.createElement('script');

  script.textContent =
    new DOMParser().parseFromString(page, 'text/html').querySelector('script')
      ?.textContent ?? '';

  document.head.append(script);
  script.remove();

  return document.documentElement.className;
}

test('the page paints with the theme saved in preferences', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  await renderHookWithQuery(() => useStoredPreferences());

  await expect.poll(paint).toBe('dark');

  document.documentElement.className = '';
});
