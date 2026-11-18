import { Copy, type LucideIcon, Shrink, SquarePen } from 'lucide-react';

import { compactConversation } from './conversations';

export type CommandContext = {
  conversationId: number | undefined;
  lastReply: string | undefined;
  newChat: (() => void) | undefined;
};

export type SlashCommand = {
  available: (context: CommandContext) => boolean;
  description: string;
  icon: LucideIcon;
  name: string;
  run: (context: CommandContext) => Promise<string | undefined>;
};

const commands: readonly SlashCommand[] = [
  {
    available: ({ conversationId }) => conversationId !== undefined,
    description: 'Summarize earlier messages to free up context',
    icon: Shrink,
    name: 'compact',
    run: async ({ conversationId }) => {
      if (conversationId === undefined) {
        return undefined;
      }

      await compactConversation(conversationId);

      return 'Compacting this chat.';
    },
  },
  {
    available: ({ lastReply }) => lastReply !== undefined,
    description: 'Copy the last reply',
    icon: Copy,
    name: 'copy',
    run: async ({ lastReply }) => {
      if (lastReply === undefined) {
        return undefined;
      }

      await navigator.clipboard.writeText(lastReply);

      return 'Copied the last reply.';
    },
  },
  {
    available: ({ newChat }) => newChat !== undefined,
    description: 'Start a new chat',
    icon: SquarePen,
    name: 'new',
    run: async ({ newChat }) => {
      newChat?.();

      return undefined;
    },
  },
];

export function matchCommands(draft: string, context: CommandContext) {
  const match = /^\/(\S*)$/.exec(draft);

  if (!match) {
    return [];
  }

  const query = (match[1] ?? '').toLowerCase();

  return commands.filter(
    (command) => command.available(context) && command.name.startsWith(query)
  );
}
