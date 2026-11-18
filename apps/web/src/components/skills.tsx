import { LoadError } from '@/components/load-error';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ListRow, ListSkeleton } from '@/components/ui/list-row';
import { PageHeader } from '@/components/ui/page';
import { Textarea } from '@/components/ui/textarea';
import {
  type Skill,
  type SkillFields,
  createSkill,
  deleteSkill,
  skillsQueryOptions,
  updateSkill,
  useSkillsUpdate,
} from '@/lib/skills';
import { undoToast } from '@/lib/undo';
import { useQuery } from '@tanstack/react-query';
import { Ellipsis, Plus, WandSparkles } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';

const blank: SkillFields = { description: '', instructions: '', name: '' };

type Editing = { kind: 'edit'; skill: Skill } | { kind: 'new' };

function SkillDialog({
  editing,
  onClose,
}: {
  editing: Editing | undefined;
  onClose: () => void;
}) {
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={!!editing}>
      <DialogContent className='sm:max-w-lg'>
        {editing && (
          <SkillForm
            key={editing.kind === 'edit' ? editing.skill.id : 'new'}
            editing={editing}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SkillForm({
  editing,
  onClose,
}: {
  editing: Editing;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<SkillFields>(
    editing.kind === 'edit'
      ? {
          description: editing.skill.description,
          instructions: editing.skill.instructions,
          name: editing.skill.name,
        }
      : blank
  );

  const create = useSkillsUpdate(createSkill, true);
  const update = useSkillsUpdate(updateSkill, true);

  const save = editing.kind === 'edit' ? update : create;

  const complete = Object.values(fields).every((value) => value.trim());

  const edit = (key: keyof SkillFields) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (editing.kind === 'edit') {
      update.mutate(
        { ...fields, id: editing.skill.id },
        { onSuccess: onClose }
      );
    } else {
      create.mutate(fields, { onSuccess: onClose });
    }
  };

  return (
    <form
      aria-label='Skill'
      className='flex flex-col gap-6'
      onSubmit={onSubmit}
    >
      <DialogHeader>
        <DialogTitle>
          {editing.kind === 'edit' ? `Edit ${editing.skill.name}` : 'New skill'}
        </DialogTitle>
        <DialogDescription>
          Lab reads a skill when a request matches when to use it.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor='skill-name'>Name</FieldLabel>
          <Input
            autoComplete='off'
            data-1p-ignore
            id='skill-name'
            maxLength={64}
            onChange={(event) => edit('name')(event.target.value)}
            value={fields.name}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor='skill-description'>When to use it</FieldLabel>
          <Input
            autoComplete='off'
            data-1p-ignore
            id='skill-description'
            maxLength={300}
            onChange={(event) => edit('description')(event.target.value)}
            value={fields.description}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor='skill-instructions'>Instructions</FieldLabel>
          <Textarea
            className='max-h-80 min-h-40'
            autoComplete='off'
            data-1p-ignore
            id='skill-instructions'
            maxLength={20_000}
            onChange={(event) => edit('instructions')(event.target.value)}
            value={fields.instructions}
          />
        </Field>
        {save.error && <FieldError>{save.error.message}</FieldError>}
      </FieldGroup>
      <DialogFooter>
        <Button onClick={onClose} type='button' variant='ghost'>
          Cancel
        </Button>
        <Button disabled={!complete || save.isPending} type='submit'>
          {editing.kind === 'edit' ? 'Save' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SkillRow({
  deleting,
  onDelete,
  onEdit,
  skill,
}: {
  deleting: boolean;
  onDelete: () => void;
  onEdit: () => void;
  skill: Skill;
}) {
  return (
    <ListRow
      actions={
        <>
          <Button
            aria-label={`Edit ${skill.name}`}
            onClick={onEdit}
            size='sm'
            variant='quiet'
          >
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={`Actions for ${skill.name}`}
                size='icon-sm'
                variant='quiet'
              >
                <Ellipsis aria-hidden='true' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem
                disabled={deleting}
                onSelect={onDelete}
                variant='destructive'
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      <WandSparkles
        aria-hidden='true'
        className='size-4 shrink-0 text-muted-foreground'
      />
      <span className='flex min-w-0 flex-col'>
        <span className='truncate font-medium'>{skill.name}</span>
        <span className='truncate text-muted-foreground'>
          {skill.description}
        </span>
      </span>
    </ListRow>
  );
}

export function Skills() {
  const skills = useQuery(skillsQueryOptions);

  const remove = useSkillsUpdate(deleteSkill);
  const restore = useSkillsUpdate(createSkill);

  const [editing, setEditing] = useState<Editing>();

  const onDelete = ({ description, id, instructions, name }: Skill) =>
    remove.mutate(id, {
      onSuccess: () =>
        undoToast('Skill deleted.', () =>
          restore.mutate({ description, instructions, name })
        ),
    });

  return (
    <>
      <PageHeader
        actions={
          <Button onClick={() => setEditing({ kind: 'new' })} size='sm'>
            <Plus aria-hidden='true' />
            New skill
          </Button>
        }
        description='Reusable instructions Lab follows when a request calls for them. Ask Lab to create or change a skill, or edit them here.'
        title='Skills'
      />
      {skills.isPending && <ListSkeleton />}
      {skills.isLoadingError && (
        <LoadError onRetry={() => skills.refetch()} subject='skills' />
      )}
      {skills.data?.skills.length === 0 && (
        <EmptyState
          description='Ask Lab to write one in any chat, or add one here.'
          title='No skills yet'
        />
      )}
      <ul className='flex flex-col gap-0.5'>
        {skills.data?.skills.map((skill) => (
          <SkillRow
            key={skill.id}
            deleting={remove.isPending}
            onDelete={() => onDelete(skill)}
            onEdit={() => setEditing({ kind: 'edit', skill })}
            skill={skill}
          />
        ))}
      </ul>
      <SkillDialog editing={editing} onClose={() => setEditing(undefined)} />
    </>
  );
}
