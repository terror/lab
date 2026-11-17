import { MessageSquareText, MessagesSquare } from 'lucide-react';

import { count, day, field, plural, quoted, readRange, text } from './format';
import { PreviewList, PreviewPassage } from './previews';
import { type ToolRenderer } from './types';

type ChatMatch = { id: number; title: string | null; updatedAt: string };

export const chatRenderers: Record<string, ToolRenderer> = {
  chat_read: {
    icon: MessageSquareText,
    preview: ({ details }) => {
      const passage = text(field(details, 'passage'));

      return passage ? <PreviewPassage>{passage}</PreviewPassage> : undefined;
    },
    summary: ({ details }) => readRange(details),
    title: ({ active, details }) => {
      const title = text(field(details, 'title'));

      if (active) {
        return 'Reading a chat';
      }

      return title ? `Read “${title}”` : 'Read a chat';
    },
  },
  chat_search: {
    icon: MessagesSquare,
    preview: ({ details }) => {
      const matches = field(details, 'matches') as ChatMatch[] | undefined;

      if (!matches?.length) {
        return undefined;
      }

      return (
        <PreviewList
          items={matches.map(({ id, title, updatedAt }) => ({
            chatId: id,
            key: String(id),
            label: title ?? 'Untitled chat',
            meta: day.format(new Date(updatedAt)),
          }))}
        />
      );
    },
    summary: ({ details }) => {
      const found = count(field(details, 'count'));

      return found === undefined ? undefined : plural(found, 'chat');
    },
    title: ({ active, args }) =>
      `${active ? 'Searching' : 'Searched'} your chats${quoted(args.query)}`,
  },
};
