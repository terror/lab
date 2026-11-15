import { modelsQueryOptions, setConversationModel } from '@/lib/models';
import { useMutation, useQuery } from '@tanstack/react-query';

export function ModelPicker({
  conversation,
  current,
}: {
  conversation: number;
  current: string | undefined;
}) {
  const models = useQuery(modelsQueryOptions);

  const change = useMutation({
    mutationFn: (model: string) => setConversationModel(conversation, model),
  });

  const options = models.data ?? [];

  const unlisted =
    current !== undefined && !options.some(({ id }) => id === current);

  return (
    <select
      aria-label='Model'
      className='h-8 max-w-48 rounded-lg bg-transparent px-2 text-sm text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50'
      disabled={options.length === 0 || change.isPending}
      onChange={(event) => change.mutate(event.target.value)}
      value={current ?? ''}
    >
      {unlisted && <option value={current}>{current}</option>}
      {options.map(({ id, name }) => (
        <option key={id} value={id}>
          {name}
        </option>
      ))}
    </select>
  );
}
