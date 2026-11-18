import { queryOptions, skipToken, useQuery } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { z } from 'zod';

import { call, callIfFound, client } from './client';
import { conversationsQueryKey } from './conversations';
import { useRefreshMutation } from './mutations';

type Method = (args: unknown, active: boolean) => Promise<unknown>;

function method<T>(
  schema: z.ZodType<T>,
  run: (args: T, active: boolean) => Promise<unknown>
): Method {
  return async (args, active) => run(schema.parse(args), active);
}

const keyed = z.object({ key: z.string() });

export function artifactCalls(conversationId: number, artifactId: string) {
  const param = { artifactId, id: String(conversationId) };

  const artifact = client.conversations[':id'].artifacts[':artifactId'];

  let saving = Promise.resolve<unknown>(undefined);

  const inOrder = (run: () => Promise<unknown>) => {
    const next = saving.then(run);

    saving = next.catch(() => undefined);

    return next;
  };

  const methods = new Map<string, Method>([
    [
      'ask',
      method(z.object({ prompt: z.string() }), async ({ prompt }, active) => {
        if (!active) {
          throw new Error(
            'lab.ask needs a click or key press in the artifact.'
          );
        }

        return (await call(artifact.ask.$post({ json: { prompt }, param })))
          .text;
      }),
    ],
    [
      'store.delete',
      method(keyed, ({ key }) =>
        inOrder(() => call(artifact.state.$delete({ param, query: { key } })))
      ),
    ],
    [
      'store.get',
      method(keyed, ({ key }) =>
        inOrder(
          async () =>
            (await call(artifact.state.$get({ param, query: { key } }))).value
        )
      ),
    ],
    [
      'store.set',
      method(keyed.extend({ value: z.string() }), ({ key, value }) =>
        inOrder(() =>
          call(artifact.state.$put({ json: { value }, param, query: { key } }))
        )
      ),
    ],
  ]);

  return async (name: string, args: unknown, active: boolean) => {
    const run = methods.get(name);

    if (!run) {
      throw new Error(`lab.${name} isn’t available.`);
    }

    return run(args, active);
  };
}

export type PinnedApp = InferResponseType<
  typeof client.conversations.pins.$get,
  200
>['pins'][number];

const pinsQueryOptions = queryOptions({
  queryKey: [...conversationsQueryKey, 'pins'],
  queryFn: ({ signal }) =>
    call(client.conversations.pins.$get(undefined, { init: { signal } })),
});

export function usePins(projectId: number | null) {
  return useQuery({
    ...pinsQueryOptions,
    select: ({ pins }) => pins.filter((pin) => pin.projectId === projectId),
  });
}

export function usePin(conversationId: number, artifactId: string) {
  return useQuery({
    ...pinsQueryOptions,
    select: ({ pins }) =>
      pins.find(
        (pin) =>
          pin.conversationId === conversationId && pin.artifactId === artifactId
      ),
  });
}

export function usePinUpdate(conversationId: number, artifactId: string) {
  const param = { artifactId, id: String(conversationId) };

  const { pin } = client.conversations[':id'].artifacts[':artifactId'];

  const options = { invalidate: [pinsQueryOptions.queryKey] };

  return {
    pin: useRefreshMutation(
      (projectId: number | null) =>
        call(pin.$put({ json: { projectId }, param })),
      options
    ),
    unpin: useRefreshMutation(() => call(pin.$delete({ param })), options),
  };
}

export function useArtifact(
  conversationId: number | undefined,
  artifactId: string | undefined
) {
  return useQuery({
    queryKey: [
      ...conversationsQueryKey,
      conversationId,
      'artifacts',
      artifactId,
    ],
    queryFn:
      conversationId === undefined || artifactId === undefined
        ? skipToken
        : ({ signal }) =>
            callIfFound(
              client.conversations[':id'].artifacts[':artifactId'].$get(
                { param: { artifactId, id: String(conversationId) } },
                { init: { signal } }
              )
            ),
    retry: false,
  });
}
