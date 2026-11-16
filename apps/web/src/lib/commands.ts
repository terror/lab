import { type LucideIcon, Shrink } from 'lucide-react';

import { compactConversation } from './conversations';

export type CommandContext = { conversationId: number | undefined };

export type SlashCommand = {
  available: (context: CommandContext) => boolean;
  description: string;
  icon: LucideIcon;
  name: string;
  run: (context: CommandContext) => Promise<string | undefined>;
};

export const commands: readonly SlashCommand[] = [
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
