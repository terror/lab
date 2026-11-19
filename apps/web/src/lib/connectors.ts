import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import { call, client } from './client';
import { useRefreshMutation } from './mutations';

type ConnectorsState = InferResponseType<typeof client.connectors.$get, 200>;

export type Connector = ConnectorsState['connectors'][number];

export type ConnectorFields = Pick<Connector, 'name' | 'url'>;

export const connectorsQueryOptions = queryOptions({
  queryKey: ['connectors'],
  queryFn: ({ signal }) =>
    call(client.connectors.$get(undefined, { init: { signal } })),
});

export function createConnector(json: ConnectorFields) {
  return call(client.connectors.$post({ json }));
}

export function setConnectorEnabled({
  enabled,
  id,
}: {
  enabled: boolean;
  id: number;
}) {
  return call(
    client.connectors[':id'].$patch({
      json: { enabled },
      param: { id: String(id) },
    })
  );
}

export function trustConnector({
  id,
  readOnly,
}: {
  id: number;
  readOnly: boolean;
}) {
  return call(
    client.connectors[':id'].trust.$put({
      json: { readOnly },
      param: { id: String(id) },
    })
  );
}

export function reconnectConnector(id: number) {
  return call(
    client.connectors[':id'].reconnect.$post({ param: { id: String(id) } })
  );
}

export function deleteConnector(id: number) {
  return call(client.connectors[':id'].$delete({ param: { id: String(id) } }));
}

export function useConnectorsUpdate<T>(
  mutationFn: (value: T) => Promise<ConnectorsState>,
  inlineError = false
) {
  return useRefreshMutation(mutationFn, {
    inlineError,
    set: connectorsQueryOptions.queryKey,
  });
}
