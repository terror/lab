import type { ChatsAccess } from '@lab/harness';

import { conversationOwner } from './records';

async function owner(conversationId: number) {
  const ownerId = await conversationOwner(conversationId);

  if (!ownerId) {
    throw new Error('This chat has no owner.');
  }

  return ownerId;
}

export const chatsAccess: ChatsAccess = {
  pin: async (conversationId, chatId, pinned) => {
    const { pinChat } = await import('./chat-actions');

    return pinChat(await owner(conversationId), chatId, pinned);
  },
  purge: async (conversationId, kind, id) => {
    const { purgeFromTrash } = await import('./trash');

    return purgeFromTrash(kind, await owner(conversationId), id);
  },
  rename: async (conversationId, chatId, title) => {
    const { renameChat } = await import('./chat-actions');

    return renameChat(await owner(conversationId), chatId, title);
  },
  restore: async (conversationId, kind, id) => {
    const { restoreFromTrash } = await import('./trash');

    return restoreFromTrash(kind, await owner(conversationId), id);
  },
  trash: async (conversationId, chatId) => {
    const ownerId = await owner(conversationId);

    const { chatSummary } = await import('./chat-actions');
    const { moveToTrash } = await import('./trash');

    const chat = await chatSummary(ownerId, chatId);

    const trashed =
      chat &&
      (await moveToTrash('conversation', ownerId, chatId, {
        running: conversationId,
      }));

    return trashed ? chat : undefined;
  },
  trashed: async (conversationId) => {
    const { listTrash } = await import('./trash');

    const items = await listTrash(await owner(conversationId));

    return items.map(({ deletedAt, id, kind, title }) => ({
      deletedAt: deletedAt.toISOString(),
      id,
      kind,
      title,
    }));
  },
};
