import { LoadError } from '@/components/load-error';
import { Button } from '@/components/ui/button';
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
import { type SubmitEvent, useState } from 'react';

const blank: SkillFields = { description: '', instructions: '', name: '' };

function SkillForm({
  initial,
  onClose,
  onSave,
}: {
  initial: SkillFields;
  onClose: () => void;
  onSave: (fields: SkillFields) => Promise<unknown>;
}) {
  const [fields, setFields] = useState(initial);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const complete = Object.values(fields).every((value) => value.trim());

  const edit = (key: keyof SkillFields) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSaving(true);

    try {
      await onSave(fields);
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      aria-label='Skill'
      className='flex flex-col gap-3 rounded-2xl bg-muted/40 p-4'
      onSubmit={onSubmit}
    >
      <Input
        aria-label='Name'
        maxLength={64}
        onChange={(event) => edit('name')(event.target.value)}
        placeholder='Name'
        value={fields.name}
      />
      <Input
        aria-label='When to use it'
        maxLength={300}
        onChange={(event) => edit('description')(event.target.value)}
        placeholder='When to use it'
        value={fields.description}
      />
      <Textarea
        aria-label='Instructions'
        className='min-h-40'
        maxLength={20_000}
        onChange={(event) => edit('instructions')(event.target.value)}
        placeholder='Instructions'
        value={fields.instructions}
      />
      {error && (
        <p role='alert' className='text-sm text-destructive'>
          {error}
        </p>
      )}
      <div className='flex justify-end gap-2'>
        <Button onClick={onClose} size='sm' type='button' variant='ghost'>
          Cancel
        </Button>
        <Button disabled={!complete || saving} size='sm' type='submit'>
          Save
        </Button>
      </div>
    </form>
  );
}

function SkillRow({
  onDelete,
  onEdit,
  skill,
}: {
  onDelete: () => void;
  onEdit: () => void;
  skill: Skill;
}) {
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
          onClick={onDelete}
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

function SkillList({ skills }: { skills: readonly Skill[] }) {
  const [editing, setEditing] = useState<string>();

  const create = useSkillsUpdate(createSkill);
  const update = useSkillsUpdate(updateSkill);
  const remove = useSkillsUpdate(deleteSkill);

  const close = () => setEditing(undefined);

  return (
    <div className='flex flex-col gap-3'>
      {skills.length === 0 && editing !== 'new' && (
        <p className='text-sm text-muted-foreground'>No skills yet.</p>
      )}
      <ul className='-mx-3 flex flex-col'>
        {skills.map((skill) =>
          editing === skill.id ? (
            <li key={skill.id} className='px-3'>
              <SkillForm
                initial={{
                  description: skill.description,
                  instructions: skill.instructions,
                  name: skill.name,
                }}
                onClose={close}
                onSave={(fields) =>
                  update.mutateAsync({ ...fields, id: skill.id })
                }
              />
            </li>
          ) : (
            <SkillRow
              key={skill.id}
              onDelete={() => remove.mutate(skill.id)}
              onEdit={() => setEditing(skill.id)}
              skill={skill}
            />
          )
        )}
      </ul>
      {editing === 'new' ? (
        <SkillForm
          initial={blank}
          onClose={close}
          onSave={(fields) => create.mutateAsync(fields)}
        />
      ) : (
        <Button
          className='self-start'
          onClick={() => setEditing('new')}
          size='sm'
          variant='secondary'
        >
          New skill
        </Button>
      )}
    </div>
  );
}

export function Skills() {
  const skills = useQuery(skillsQueryOptions);

  return (
    <section className='space-y-8'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>Skills</h1>
        <p className='text-sm text-muted-foreground'>
          Reusable instructions Lab follows when a request calls for them. Ask
          Lab to create or change a skill, or edit them here.
        </p>
      </div>
      {skills.isError && <LoadError subject='skills' />}
      {skills.data && <SkillList skills={skills.data.skills} />}
    </section>
  );
}
