import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { render, renderHook } from 'vitest-browser-react';

export function requestUrl(input: RequestInfo | URL) {
  return new URL(
    input instanceof Request ? input.url : input.toString(),
    window.location.href
  );
}

export function stubFetch(
  handler: (url: URL, init?: RequestInit) => Response | Promise<Response>
) {
  return vi
    .spyOn(window, 'fetch')
    .mockImplementation(async (input, init) =>
      handler(requestUrl(input), init)
    );
}

export function fetchedPaths(fetch: ReturnType<typeof stubFetch>) {
  return fetch.mock.calls.map(([input]) => {
    const url = requestUrl(input);

    return `${url.pathname}${url.search}`;
  });
}

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

export async function renderWithQuery(
  ui: ReactNode,
  client = new QueryClient()
) {
  const screen = await render(ui, { wrapper: wrapper(client) });

  return { client, screen };
}

export function renderHookWithQuery<T>(
  hook: () => T,
  client = new QueryClient()
) {
  return renderHook(hook, { wrapper: wrapper(client) });
}
