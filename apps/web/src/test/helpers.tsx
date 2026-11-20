import { preferencesQueryOptions } from '@/lib/preferences';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { onTestFinished, vi } from 'vitest';
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

export function preferencesClient(preferences = defaultPreferences) {
  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, preferences);

  return client;
}

function wrapper(client: QueryClient) {
  onTestFinished(() => client.clear());

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

type Listener = (event: { data: string }) => void;

export class FakeEventSource {
  static current: FakeEventSource | undefined;

  closed = false;
  listeners = new Map<string, Listener>();
  url: string | URL;

  constructor(url: string | URL) {
    this.url = url;
    FakeEventSource.current = this;
  }

  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data: unknown) {
    this.listeners.get(type)?.({
      data: typeof data === 'string' ? data : JSON.stringify(data),
    });
  }
}
