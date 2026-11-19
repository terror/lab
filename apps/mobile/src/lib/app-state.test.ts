import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { expect, mock, test } from 'bun:test';

let change: ((status: string) => void) | undefined;

await mock.module('react-native', () => ({
  AppState: {
    addEventListener: (_: string, listener: (status: string) => void) => {
      change = listener;

      return { remove: () => {} };
    },
  },
  Platform: { OS: 'ios' },
}));

test('coming back to the app refetches what is on screen', async () => {
  const { refetchOnForeground } = await import('./app-state');

  refetchOnForeground();

  const queryClient = new QueryClient();

  queryClient.mount();

  const queryFn = mock(async () => 'foo');

  const observer = new QueryObserver(queryClient, {
    queryFn,
    queryKey: ['foo'],
  });

  const unsubscribe = observer.subscribe(() => {});

  await queryClient.getQueryCache().find({ queryKey: ['foo'] })?.promise;

  change?.('background');
  change?.('active');

  await queryClient.getQueryCache().find({ queryKey: ['foo'] })?.promise;

  unsubscribe();
  queryClient.unmount();

  expect(queryFn).toHaveBeenCalledTimes(2);
});
