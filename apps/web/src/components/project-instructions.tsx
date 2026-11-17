import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { type Project, updateProject, useProjectSave } from '@/lib/projects';
import { type SubmitEvent, useState } from 'react';

function InstructionsForm({
  onClose,
  project,
}: {
  onClose: () => void;
  project: Project;
}) {
  const [instructions, setInstructions] = useState(project.instructions);

  const save = useProjectSave(updateProject);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    save.mutate({ id: project.id, instructions }, { onSuccess: onClose });
  };

  return (
    <form
      aria-label='Instructions'
      className='flex flex-col gap-6'
      onSubmit={onSubmit}
    >
      <DialogHeader>
        <DialogTitle>Instructions</DialogTitle>
        <DialogDescription>
          Lab follows these in every chat in {project.name}.
        </DialogDescription>
      </DialogHeader>
      <Textarea
        aria-label='Instructions'
        autoComplete='off'
        className='max-h-80 min-h-40'
        data-1p-ignore
        maxLength={8_000}
        onChange={(event) => setInstructions(event.target.value)}
        placeholder='Use a friendly tone and keep answers short.'
        value={instructions}
      />
      {save.error && <FieldError>{save.error.message}</FieldError>}
      <DialogFooter>
        <Button onClick={onClose} type='button' variant='ghost'>
          Cancel
        </Button>
        <Button disabled={save.isPending} type='submit'>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ProjectInstructions({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);

  const instructions = project.instructions.trim();

  return (
    <>
      <button
        aria-label='Edit instructions'
        className='flex flex-col gap-1 rounded-2xl border px-4 py-3 text-left outline-none hover:bg-muted/50'
        onClick={() => setOpen(true)}
        type='button'
      >
        <span className='text-sm font-medium'>Instructions</span>
        <span className='line-clamp-2 text-sm text-muted-foreground'>
          {instructions || 'Tell Lab how to respond in this project.'}
        </span>
      </button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className='sm:max-w-lg'>
          {open && (
            <InstructionsForm
              onClose={() => setOpen(false)}
              project={project}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
