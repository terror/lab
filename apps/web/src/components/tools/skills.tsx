import { cn } from '@/lib/utils';
import { WandSparkles } from 'lucide-react';

import { field, text } from './format';
import { PreviewPassage, SettingsLink } from './previews';
import { type ToolRenderer, type ToolView } from './types';

const manageSkills = (
  <SettingsLink section='skills'>Manage skills</SettingsLink>
);

function SkillCard({
  deleted = false,
  details,
}: {
  deleted?: boolean;
  details: unknown;
}) {
  const name = text(field(details, 'name'));

  const description = text(field(details, 'description'));

  if (!name) {
    return undefined;
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 rounded-xl bg-muted/40 px-3.5 py-3 text-sm',
        deleted && 'text-muted-foreground line-through'
      )}
    >
      <span className='font-medium'>{name}</span>
      {description && (
        <span className='text-muted-foreground'>{description}</span>
      )}
    </div>
  );
}

function skillTitle(running: string, done: string) {
  return ({ active, details }: ToolView) => {
    const name = text(field(details, 'name'));

    if (active) {
      return running;
    }

    return name ? `${done} the “${name}” skill` : `${done} a skill`;
  };
}

export const skillRenderers = {
  skill_create: {
    actions: manageSkills,
    icon: WandSparkles,
    preview: ({ details }) => <SkillCard details={details} />,
    title: skillTitle('Creating a skill', 'Created'),
  },
  skill_delete: {
    actions: manageSkills,
    icon: WandSparkles,
    preview: ({ details }) => <SkillCard deleted details={details} />,
    title: skillTitle('Deleting a skill', 'Deleted'),
  },
  skill_read: {
    actions: manageSkills,
    icon: WandSparkles,
    preview: ({ details }) => {
      const instructions = text(field(details, 'instructions'));

      return instructions ? (
        <PreviewPassage>{instructions}</PreviewPassage>
      ) : undefined;
    },
    title: skillTitle('Reading a skill', 'Read'),
  },
  skill_update: {
    actions: manageSkills,
    icon: WandSparkles,
    preview: ({ details }) => <SkillCard details={details} />,
    title: skillTitle('Updating a skill', 'Updated'),
  },
} satisfies Record<string, ToolRenderer>;
