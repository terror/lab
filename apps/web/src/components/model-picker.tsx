import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  type Model,
  type ModelChoice,
  type ThinkingLevel,
  modelsQueryOptions,
} from '@/lib/models';
import { thinkingLevelSchema } from '@lab/server/schemas';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';

const levels = thinkingLevelSchema.options;

const levelLabels: Record<ThinkingLevel, string> = {
  high: 'High',
  low: 'Low',
  max: 'Max',
  medium: 'Medium',
  minimal: 'Minimal',
  off: 'Off',
  xhigh: 'Extra high',
};

function ModelOption({
  active,
  level,
  model,
  onSelect,
}: {
  active: boolean;
  level: ThinkingLevel;
  model: Model;
  onSelect: (choice: ModelChoice) => void;
}) {
  if (!hasLevels(model)) {
    return (
      <DropdownMenuItem
        onSelect={() => onSelect({ id: model.id, thinkingLevel: 'off' })}
      >
        <span className='truncate'>{model.name}</span>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <span className='truncate'>{model.name}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className='min-w-40'>
        <DropdownMenuLabel className='text-xs text-muted-foreground'>
          Thinking
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          aria-label={`Thinking for ${model.name}`}
          onValueChange={(value) => {
            const thinkingLevel = levels.find(
              (candidate) => candidate === value
            );

            if (thinkingLevel) {
              onSelect({ id: model.id, thinkingLevel });
            }
          }}
          value={active ? level : ''}
        >
          {model.thinkingLevels.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {levelLabels[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function groupByProvider(models: Model[]) {
  const groups = new Map<string, Model[]>();

  for (const model of models) {
    groups.set(model.provider, [...(groups.get(model.provider) ?? []), model]);
  }

  return [...groups];
}

function hasLevels(model: Model) {
  return model.thinkingLevels.length > 1;
}

function clamp(model: Model, level: ThinkingLevel) {
  const supported = (candidate: ThinkingLevel) =>
    model.thinkingLevels.includes(candidate);

  const index = levels.indexOf(level);

  return (
    levels.slice(index).find(supported) ??
    levels.slice(0, index).findLast(supported) ??
    'off'
  );
}

function currentLevel(model: Model, choice: ModelChoice | undefined) {
  return clamp(model, choice?.thinkingLevel ?? 'off');
}

function triggerLabel(
  model: Model | undefined,
  choice: ModelChoice | undefined
) {
  if (!choice) {
    return 'Model';
  }

  if (!model) {
    return choice.id;
  }

  const level = currentLevel(model, choice);

  if (!hasLevels(model) || level === 'off') {
    return model.name;
  }

  return `${model.name} (${levelLabels[level]})`;
}

export function ModelPicker({
  disabled,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (model: ModelChoice) => void;
  value: ModelChoice | undefined;
}) {
  const models = useQuery(modelsQueryOptions);

  const options = models.data ?? [];
  const current = options.find(({ id }) => id === value?.id);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className='flex min-w-0 items-center gap-1 text-sm text-muted-foreground outline-none disabled:opacity-50'
          disabled={disabled || options.length === 0}
          type='button'
        >
          <span className='truncate'>{triggerLabel(current, value)}</span>
          <ChevronDown aria-hidden='true' className='size-4 shrink-0' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='end'
        className='w-72 max-w-[calc(100vw-2rem)]'
      >
        {groupByProvider(options).map(([provider, group]) => (
          <DropdownMenuGroup aria-label={provider} key={provider}>
            <DropdownMenuLabel className='text-xs text-muted-foreground'>
              {provider}
            </DropdownMenuLabel>
            {group.map((model) => (
              <ModelOption
                key={model.id}
                active={model.id === current?.id}
                level={currentLevel(model, value)}
                model={model}
                onSelect={onChange}
              />
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
