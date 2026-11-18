import type { ChatsAccess } from '@lab/harness';

import { chatSummary, pinChat, renameChat } from './chat-actions';
import { requireOwner } from './records';
import {
  listTrash,
  moveToTrash,
  purgeFromTrash,
  restoreFromTrash,
} from './trash-items';

export const chatsAccess: ChatsAccess = {
  pin: async (conversationId, chatId, pinned) =>
    pinChat(await requireOwner(conversationId), chatId, pinned),
  purge: async (conversationId, kind, id) =>
    (await purgeFromTrash(kind, await requireOwner(conversationId), id)) !==
    undefined,
  rename: async (conversationId, chatId, title) =>
    renameChat(await requireOwner(conversationId), chatId, title),
  restore: async (conversationId, kind, id) =>
    restoreFromTrash(kind, await requireOwner(conversationId), id),
  trash: async (conversationId, chatId) => {
    const ownerId = await requireOwner(conversationId);

    const chat = await chatSummary(ownerId, chatId);

    const trashed =
      chat &&
      (await moveToTrash('conversation', ownerId, chatId, {
        running: conversationId,
      }));

    return trashed ? chat : undefined;
  },
  trashed: async (conversationId) =>
    listTrash(await requireOwner(conversationId)),
};
