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
import {
  type Project,
  createProject,
  updateProject,
  useProjectSave,
} from '@/lib/projects';
import { type SubmitEvent, useState } from 'react';

export type ProjectEditing =
  | { kind: 'new' }
  | { kind: 'rename'; project: Project };

const copy = {
  new: { action: 'Create', title: 'New project' },
  rename: { action: 'Save', title: 'Rename project' },
};

function ProjectForm({
  editing,
  onClose,
  onCreated,
}: {
  editing: ProjectEditing;
  onClose: () => void;
  onCreated?: (project: Project) => void;
}) {
  const [name, setName] = useState(
    editing.kind === 'rename' ? editing.project.name : ''
  );

  const create = useProjectSave(createProject);
  const rename = useProjectSave(updateProject);

  const save = editing.kind === 'rename' ? rename : create;

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (editing.kind === 'rename') {
      rename.mutate({ id: editing.project.id, name }, { onSuccess: onClose });
    } else {
      create.mutate(name, {
        onSuccess: (project) => {
          onClose();
          onCreated?.(project);
        },
      });
    }
  };

  return (
    <form
      aria-label='Project'
      className='flex flex-col gap-6'
      onSubmit={onSubmit}
    >
      <DialogHeader>
        <DialogTitle>{copy[editing.kind].title}</DialogTitle>
        <DialogDescription>
          Projects keep related chats together.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor='project-name'>Name</FieldLabel>
          <Input
            autoComplete='off'
            data-1p-ignore
            id='project-name'
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </Field>
        {save.error && <FieldError>{save.error.message}</FieldError>}
      </FieldGroup>
      <DialogFooter>
        <Button onClick={onClose} type='button' variant='ghost'>
          Cancel
        </Button>
        <Button disabled={!name.trim() || save.isPending} type='submit'>
          {copy[editing.kind].action}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ProjectDialog({
  editing,
  onClose,
  onCreated,
}: {
  editing: ProjectEditing | undefined;
  onClose: () => void;
  onCreated?: (project: Project) => void;
}) {
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={!!editing}>
      <DialogContent className='sm:max-w-md'>
        {editing && (
          <ProjectForm
            key={editing.kind === 'rename' ? editing.project.id : 'new'}
            editing={editing}
            onClose={onClose}
            onCreated={onCreated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
