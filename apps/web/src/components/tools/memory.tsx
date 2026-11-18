import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { cn } from '@/lib/utils';
import { useQuiet } from '@/lib/voice';
import { Bookmark, BookmarkX } from 'lucide-react';

import { field, text } from './format';
import { SettingsLink } from './previews';
import { type ToolRenderer, type ToolView } from './types';

function MemoryNote({
  forgotten = false,
  text: note,
}: {
  forgotten?: boolean;
  text: string;
}) {
  return (
    <Card variant='inset'>
      <p
        className={cn(
          'text-sm/relaxed text-foreground',
          forgotten && 'text-muted-foreground line-through'
        )}
      >
        {note}
      </p>
    </Card>
  );
}

function MemoryChip({
  forgotten = false,
  text: note,
}: {
  forgotten?: boolean;
  text: string;
}) {
  const quiet = useQuiet();

  const flourish = !forgotten && !quiet;

  return (
    <div className='flex min-w-0 animate-in items-center gap-2 text-sm duration-base fade-in'>
      <Chip tone={forgotten ? 'neutral' : 'done'}>
        {forgotten ? (
          <BookmarkX aria-hidden='true' />
        ) : (
          <Bookmark aria-hidden='true' data-ribbon={flourish || undefined} />
        )}
        {forgotten ? 'Forgot' : 'Remembered'}
      </Chip>
      <span
        className={cn(
          'min-w-0 truncate text-muted-foreground',
          forgotten && 'line-through'
        )}
        data-highlight={flourish || undefined}
      >
        {note}
      </span>
      <SettingsLink section='memory'>Manage</SettingsLink>
    </div>
  );
}

const manageMemories = (
  <SettingsLink section='memory'>Manage memories</SettingsLink>
);

function forgottenText({ args, details, history }: ToolView) {
  const saved = text(field(details, 'text'));

  if (saved) {
    return saved;
  }

  const id = text(args.id);

  const remembered = history.find(
    (record) =>
      record.name === 'remember' && text(field(record.details, 'id')) === id
  );

  return (
    remembered &&
    (text(field(remembered.details, 'text')) ?? text(remembered.args.text))
  );
}

export const memoryRenderers = {
  forget: {
    actions: manageMemories,
    icon: BookmarkX,
    inline: (view) => {
      const note = forgottenText(view);

      return !view.active && view.details && note ? (
        <MemoryChip forgotten text={note} />
      ) : undefined;
    },
    preview: (view) => {
      const note = forgottenText(view);

      if (!note) {
        return (
          <p className='text-sm text-muted-foreground'>
            The forgotten memory's text isn't available.
          </p>
        );
      }

      return <MemoryNote forgotten text={note} />;
    },
    title: (view) => {
      const note = forgottenText(view);

      if (view.active) {
        return 'Forgetting a memory';
      }

      return note ? `Forgot “${note}”` : 'Forgot a memory';
    },
  },
  remember: {
    actions: manageMemories,
    icon: Bookmark,
    inline: ({ active, args, details }) => {
      const note = text(field(details, 'text')) ?? text(args.text);

      return !active && note && details ? (
        <MemoryChip text={note} />
      ) : undefined;
    },
    preview: ({ args, details }) => {
      const note = text(field(details, 'text')) ?? text(args.text);

      return note && details ? <MemoryNote text={note} /> : undefined;
    },
    title: ({ active, args }) => {
      const memory = text(args.text);

      const verb = active ? 'Remembering' : 'Remembered';

      return memory ? `${verb} “${memory}”` : verb;
    },
  },
} satisfies Record<string, ToolRenderer>;
