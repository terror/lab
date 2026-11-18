import {
  type ConversationId,
  type JsonObject,
  defineDoc,
  defineDocFamily,
} from '@earendil-works/pi-durable';

export type Owner = (conversationId: ConversationId) => Promise<string>;

export function conversationDoc<T extends JsonObject>(
  kind: string,
  initial: () => T
) {
  return defineDoc<T>({
    checkpointWhen: () => true,
    fork: 'current',
    history: 'latest',
    initial,
    kind,
    scope: 'conversation',
    version: 1,
  });
}

export function userDoc<T extends JsonObject>(kind: string, initial: () => T) {
  return defineDocFamily<T, null>({
    checkpointWhen: () => true,
    family: true,
    initial: () => initial(),
    kind,
    scope: 'session',
    version: 1,
  });
}
