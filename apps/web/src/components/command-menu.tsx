import { Kbd } from '@/components/ui/kbd';
import {
  type CommandContext,
  type SlashCommand,
  matchCommands,
} from '@/lib/commands';
import { cn } from '@/lib/utils';
import { type KeyboardEvent, useId, useState } from 'react';

export function useCommandMenu(
  draft: string,
  context: CommandContext,
  onRun: (command: SlashCommand) => void
) {
  const id = useId();
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<string>();

  const matches = matchCommands(draft, context);

  const open = matches.length > 0 && dismissed !== draft;

  const current = Math.min(active, matches.length - 1);

  const selected = matches[current];

  const run = (command: SlashCommand) => {
    setActive(0);
    onRun(command);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((current + 1) % matches.length),
      ArrowUp: () => setActive((current - 1 + matches.length) % matches.length),
      Enter: () => selected && run(selected),
      Escape: () => setDismissed(draft),
      Tab: () => selected && run(selected),
    };

    const handle = keys[event.key];

    if (!open || !handle || event.shiftKey || event.nativeEvent.isComposing) {
      return false;
    }

    event.preventDefault();
    handle();

    return true;
  };

  const textbox = open
    ? {
        'aria-activedescendant': selected && commandId(id, selected),
        'aria-autocomplete': 'list' as const,
        'aria-controls': id,
      }
    : {};

  return { id, matches, onKeyDown, open, run, selected, textbox };
}

function commandId(id: string, command: SlashCommand) {
  return `${id}-${command.name}`;
}

export function CommandMenu({
  id,
  matches,
  onRun,
  selected,
}: {
  id: string;
  matches: readonly SlashCommand[];
  onRun: (command: SlashCommand) => void;
  selected: SlashCommand | undefined;
}) {
  return (
    <div className='absolute inset-x-2 bottom-full mb-2 flex animate-in flex-col rounded-menu bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-base ease-out fade-in-0 zoom-in-95 slide-in-from-bottom-2'>
      <ul aria-label='Commands' className='flex flex-col' id={id}>
        {matches.map((command) => (
          <li key={command.name}>
            <button
              aria-current={command === selected ? 'true' : undefined}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                command === selected && 'bg-accent text-accent-foreground'
              )}
              id={commandId(id, command)}
              onClick={() => onRun(command)}
              onMouseDown={(event) => event.preventDefault()}
              type='button'
            >
              <command.icon
                aria-hidden='true'
                className='size-4 shrink-0 text-muted-foreground'
              />
              <span className='font-medium'>/{command.name}</span>
              <span className='truncate text-muted-foreground'>
                {command.description}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className='flex gap-3 px-1.5 pt-1.5 pb-0.5 text-xs text-muted-foreground pointer-coarse:hidden'>
        <span className='flex items-center gap-1'>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          to choose
        </span>
        <span className='flex items-center gap-1'>
          <Kbd>↵</Kbd>
          to run
        </span>
        <span className='flex items-center gap-1'>
          <Kbd>esc</Kbd>
          to close
        </span>
      </p>
    </div>
  );
}
