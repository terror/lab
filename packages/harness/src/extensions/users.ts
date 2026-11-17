import {
  type ConversationId,
  type JsonObject,
  defineDocFamily,
} from '@earendil-works/pi-durable';

export type Owner = (conversationId: ConversationId) => Promise<string>;

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
