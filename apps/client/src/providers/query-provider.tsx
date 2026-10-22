import { useAuth } from '@/hooks/use-auth';
import {
  canRetry,
  errorPresentation,
  isAbortError,
  notifyError,
} from '@/lib/errors';
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { toast } from 'sonner';

type ErrorMeta = { errorToast?: boolean };

type QueryScope = {
  signal: AbortSignal;
};

const QueryScopeContext = createContext<QueryScope | null>(null);

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: ErrorMeta;
    mutationMeta: ErrorMeta;
  }
}

function createQueryClient(signal: AbortSignal) {
  const failures = new WeakMap<object, string>();

  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (
          signal.aborted ||
          query.state.data === undefined ||
          query.meta?.errorToast === false ||
          isAbortError(error)
        ) {
          return;
        }

        const { id } = errorPresentation(error);

        if (failures.get(query) === id) {
          return;
        }

        failures.set(query, id);

        notifyError(error, {
          id: `query:${query.queryHash}`,
          onRetry: () => {
            if (signal.aborted) {
              return;
            }

            failures.delete(query);

            void query.fetch().catch(() => undefined);
          },
        });
      },
      onSuccess: (_, query) => {
        if (!signal.aborted && failures.delete(query)) {
          toast.dismiss(`query:${query.queryHash}`);
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (!signal.aborted && mutation.meta?.errorToast !== false) {
          notifyError(error);
        }
      },
    }),
    defaultOptions: {
      queries: {
        retry: (count, error) => count < 2 && canRetry(error),
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  const userId = auth.data?.user.id ?? null;
  const sessionId = auth.data?.session.id ?? null;

  return (
    <AccountQueries key={`${userId}:${sessionId}`}>{children}</AccountQueries>
  );
}

function AccountQueries({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<
    (QueryScope & { client: QueryClient }) | null
  >(null);

  useEffect(() => {
    const controller = new AbortController();
    const client = createQueryClient(controller.signal);

    setScope({ signal: controller.signal, client });

    return () => {
      controller.abort();
      client.clear();
      toast.dismiss();
    };
  }, []);

  if (!scope || scope.signal.aborted) {
    return null;
  }

  return (
    <QueryScopeContext value={scope}>
      <QueryClientProvider client={scope.client}>
        {children}
      </QueryClientProvider>
    </QueryScopeContext>
  );
}

export function useQueryScope() {
  const scope = useContext(QueryScopeContext);

  if (!scope) {
    throw new Error('useQueryScope requires QueryProvider');
  }

  return scope;
}
