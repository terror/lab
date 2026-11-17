import { cn } from '@/lib/utils';
import { Lightbulb } from 'lucide-react';

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
    <p
      className={cn(
        'rounded-xl bg-muted/40 px-3.5 py-3 text-sm/relaxed text-foreground/90',
        forgotten && 'text-muted-foreground line-through'
      )}
    >
      {note}
    </p>
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

export const memoryRenderers: Record<string, ToolRenderer> = {
  forget: {
    actions: manageMemories,
    icon: Lightbulb,
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
    icon: Lightbulb,
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
};
