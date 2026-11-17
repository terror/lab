import { LoadError } from '@/components/load-error';
import { SettingsPage } from '@/components/settings-page';
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
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
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
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
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

function SkillRow({ onEdit, skill }: { onEdit: () => void; skill: Skill }) {
  const remove = useSkillsUpdate(deleteSkill);

  return (
    <li className='flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-muted/50'>
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-medium'>{skill.name}</p>
        <p className='truncate text-sm text-muted-foreground'>
          {skill.description}
        </p>
      </div>
      <div className='flex shrink-0 items-center gap-1'>
        <Button
          aria-label={`Delete ${skill.name}`}
          disabled={remove.isPending}
          onClick={() => remove.mutate(skill.id)}
          size='sm'
          variant='ghost'
        >
          Delete
        </Button>
        <Button
          aria-label={`Edit ${skill.name}`}
          onClick={onEdit}
          size='sm'
          variant='secondary'
        >
          Edit
        </Button>
      </div>
    </li>
  );
}

export function Skills() {
  const skills = useQuery(skillsQueryOptions);

  const [editing, setEditing] = useState<Editing>();

  return (
    <SettingsPage
      action={
        <Button onClick={() => setEditing({ kind: 'new' })} size='sm'>
          <Plus aria-hidden='true' />
          New skill
        </Button>
      }
      description={
        'Reusable instructions Lab follows when a request calls for them. Ask Lab to create or change a skill, or edit them here.'
      }
      title='Skills'
    >
      {skills.isError && <LoadError subject='skills' />}
      {skills.data?.skills.length === 0 && (
        <p className='text-sm text-muted-foreground'>No skills yet.</p>
      )}
      {skills.data && skills.data.skills.length > 0 && (
        <ul className='-mx-3 flex flex-col'>
          {skills.data.skills.map((skill) => (
            <SkillRow
              key={skill.id}
              onEdit={() => setEditing({ kind: 'edit', skill })}
              skill={skill}
            />
          ))}
        </ul>
      )}
      <SkillDialog editing={editing} onClose={() => setEditing(undefined)} />
    </SettingsPage>
  );
}
