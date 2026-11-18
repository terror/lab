import type { ChatsAccess } from '@lab/harness';

import { requireOwner } from './records';

export const chatsAccess: ChatsAccess = {
  pin: async (conversationId, chatId, pinned) => {
    const { pinChat } = await import('./chat-actions');

    return pinChat(await requireOwner(conversationId), chatId, pinned);
  },
  purge: async (conversationId, kind, id) => {
    const { purgeFromTrash } = await import('./trash-items');

    return (
      (await purgeFromTrash(kind, await requireOwner(conversationId), id)) !==
      undefined
    );
  },
  rename: async (conversationId, chatId, title) => {
    const { renameChat } = await import('./chat-actions');

    return renameChat(await requireOwner(conversationId), chatId, title);
  },
  restore: async (conversationId, kind, id) => {
    const { restoreFromTrash } = await import('./trash-items');

    return restoreFromTrash(kind, await requireOwner(conversationId), id);
  },
  trash: async (conversationId, chatId) => {
    const ownerId = await requireOwner(conversationId);

    const { chatSummary } = await import('./chat-actions');
    const { moveToTrash } = await import('./trash-items');

    const chat = await chatSummary(ownerId, chatId);

    const trashed =
      chat &&
      (await moveToTrash('conversation', ownerId, chatId, {
        running: conversationId,
      }));

    return trashed ? chat : undefined;
  },
  trashed: async (conversationId) => {
    const { listTrash } = await import('./trash-items');

    return listTrash(await requireOwner(conversationId));
  },
};
