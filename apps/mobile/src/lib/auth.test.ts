import { QueryClient } from '@tanstack/react-query';
import { expect, mock, test } from 'bun:test';

await mock.module('expo-constants', () => ({
  default: { expoConfig: { scheme: 'foo' } },
}));

await mock.module('expo-linking', () => ({ createURL: () => 'foo://' }));

await mock.module('expo-secure-store', () => {
  const items = new Map<string, string>();

  return {
    getItemAsync: async (key: string) => items.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      items.set(key, value);
    },
  };
});

await mock.module('react-native', () => ({
  AppState: { addEventListener: () => ({ remove: () => {} }) },
  Platform: { OS: 'ios' },
}));

test('signing out clears the query cache', async () => {
  process.env.EXPO_PUBLIC_LAB_ORIGIN = 'http://foo.test';

  globalThis.fetch = mock(async () =>
    Response.json({ success: true })
  ) as unknown as typeof fetch;

  const { signOut } = await import('./auth');

  const queryClient = new QueryClient();

  queryClient.setQueryData(['conversations'], 'baz');

  await signOut(queryClient);

  expect(queryClient.getQueryCache().getAll()).toEqual([]);
});
