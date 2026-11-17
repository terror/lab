import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { conversationsQueryKey } from '@/lib/conversations';
import { usePath } from '@/lib/location';
import {
  type Project,
  deleteProject,
  projectsQueryOptions,
} from '@/lib/projects';
import { useUndoTrash } from '@/lib/trash';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function ProjectMenu({
  className,
  onRename,
  project,
}: {
  className?: string;
  onRename: () => void;
  project: Project;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const path = usePath();

  const page = `/projects/${project.id}`;

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: projectsQueryOptions.queryKey,
      }),
      queryClient.invalidateQueries({ queryKey: conversationsQueryKey }),
    ]);

  const undo = useUndoTrash();

  const remove = useMutation({
    mutationFn: () => deleteProject(project.id),
    onSuccess: async () => {
      const viewing = path === page;

      toast('Project moved to Trash.', {
        action: {
          label: 'Undo',
          onClick: () =>
            void undo({ id: project.id, kind: 'project' }, async () => {
              if (viewing) {
                await navigate({
                  params: { projectId: String(project.id) },
                  to: '/projects/$projectId',
                });
              }
            }),
        },
      });

      if (viewing) {
        await navigate({ to: '/' });
      }

      await refresh();
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Options for ${project.name}`}
          className={cn(
            'flex items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground',
            className
          )}
          type='button'
        >
          <Ellipsis aria-hidden='true' className='size-4' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start'>
        <DropdownMenuItem onSelect={onRename}>
          <Pencil aria-hidden='true' />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => remove.mutate()}
          variant='destructive'
        >
          <Trash2 aria-hidden='true' />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
