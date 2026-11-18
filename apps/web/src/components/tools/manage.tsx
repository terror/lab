import { conversationTitle } from '@/lib/conversations';
import { shortDate } from '@/lib/format';
import { ArchiveRestore, Pencil, Pin, Trash2 } from 'lucide-react';

import { count, declined, field, text } from './format';
import { PreviewList } from './previews';
import type { ToolRenderer, ToolView } from './types';

function chatPreview(meta: string, linked: boolean) {
  return ({ details }: ToolView) => {
    const chat = field(details, 'chat');

    const id = count(field(chat, 'id'));

    if (id === undefined) {
      return undefined;
    }

    return (
      <PreviewList
        items={[
          {
            chatId: linked ? id : undefined,
            key: String(id),
            label: conversationTitle(text(field(chat, 'title')) ?? null),
            meta,
          },
        ]}
      />
    );
  };
}

function trashItem(item: unknown, index: number) {
  const kind = text(field(item, 'kind'));

  const deletedAt = text(field(item, 'deletedAt'));

  const title = text(field(item, 'title')) ?? null;

  return {
    key: `${kind ?? ''}-${count(field(item, 'id')) ?? index}`,
    label:
      kind === 'project'
        ? (title ?? 'Untitled project')
        : conversationTitle(title),
    meta: [
      kind === 'project' ? 'Project' : 'Chat',
      deletedAt && shortDate(deletedAt),
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

function itemPreview({ details }: ToolView) {
  const item = field(details, 'item');

  return item ? <PreviewList items={[trashItem(item, 0)]} /> : undefined;
}

export const manageRenderers = {
  chat_delete: {
    icon: Trash2,
    preview: chatPreview('In Trash', false),
    title: ({ active }) =>
      active ? 'Deleting a chat' : 'Moved a chat to Trash',
  },
  chat_pin: {
    icon: Pin,
    preview: chatPreview('Pinned', true),
    title: ({ active, details }) => {
      if (active) {
        return 'Pinning a chat';
      }

      return field(field(details, 'chat'), 'pinned') === false
        ? 'Unpinned a chat'
        : 'Pinned a chat';
    },
  },
  chat_rename: {
    icon: Pencil,
    preview: chatPreview('Renamed', true),
    title: ({ active }) => (active ? 'Renaming a chat' : 'Renamed a chat'),
  },
  trash_list: {
    icon: Trash2,
    preview: ({ details }) => {
      const items = field(details, 'items');

      return Array.isArray(items) ? (
        <PreviewList items={items.map(trashItem)} />
      ) : undefined;
    },
    title: ({ active }) =>
      active ? 'Checking the Trash' : 'Checked the Trash',
  },
  trash_purge: {
    icon: Trash2,
    preview: itemPreview,
    title: declined(
      ({ active }) => (active ? 'Deleting forever' : 'Deleted forever'),
      'Didn’t delete forever'
    ),
  },
  trash_restore: {
    icon: ArchiveRestore,
    preview: itemPreview,
    title: ({ active }) =>
      active ? 'Restoring from Trash' : 'Restored from Trash',
  },
} satisfies Record<string, ToolRenderer>;
