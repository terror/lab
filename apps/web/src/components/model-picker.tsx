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
import { Check, ChevronDown, Search } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';

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

function supportedLevels(model: Model) {
  return levels.filter((level) => model.thinkingLevels.includes(level));
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
  if (!model) {
    return choice?.id ?? 'Model';
  }

  const level = currentLevel(model, choice);

  if (!hasLevels(model) || level === 'off') {
    return model.name;
  }

  return `${model.name} (${levelLabels[level]})`;
}

function groupByProvider(models: Model[]) {
  const groups = new Map<string, Model[]>();

  for (const model of models) {
    groups.set(model.providerName, [
      ...(groups.get(model.providerName) ?? []),
      model,
    ]);
  }

  return [...groups];
}

function matches(model: Model, search: string) {
  const haystack = [model.name, model.id, model.providerName]
    .join(' ')
    .toLowerCase();

  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);

  return terms.every((term) => haystack.includes(term));
}

function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'ArrowDown') {
    event.preventDefault();

    event.currentTarget
      .closest('[role=menu]')
      ?.querySelector<HTMLElement>('[role^=menuitem]')
      ?.focus();

    return;
  }

  if (event.key !== 'Escape' && event.key !== 'Tab') {
    event.stopPropagation();
  }
}

function ModelOption({
  current,
  model,
  onSelect,
  value,
}: {
  current: boolean;
  model: Model;
  onSelect: (choice: ModelChoice) => void;
  value: ModelChoice | undefined;
}) {
  const check = current && (
    <Check aria-hidden='true' className='ml-auto size-4' />
  );

  if (!hasLevels(model)) {
    return (
      <DropdownMenuItem
        onSelect={() =>
          onSelect({
            id: model.id,
            provider: model.provider,
            thinkingLevel: 'off',
          })
        }
      >
        <span className='truncate'>{model.name}</span>
        {check}
      </DropdownMenuItem>
    );
  }

  const level = current ? currentLevel(model, value) : '';

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <span className='truncate'>{model.name}</span>
        {check}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className='min-w-40'>
        <DropdownMenuLabel className='text-xs text-muted-foreground'>
          Thinking
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          aria-label={`Thinking for ${model.name}`}
          onValueChange={(next) => {
            const thinkingLevel = supportedLevels(model).find(
              (candidate) => candidate === next
            );

            if (thinkingLevel) {
              onSelect({
                id: model.id,
                provider: model.provider,
                thinkingLevel,
              });
            }
          }}
          value={level}
        >
          {supportedLevels(model).map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {levelLabels[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
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
  const [search, setSearch] = useState('');

  const options = models.data?.models ?? [];

  const current = options.find(
    ({ id, provider }) => id === value?.id && provider === value.provider
  );

  const groups = groupByProvider(
    options.filter((model) => matches(model, search))
  );

  return (
    <DropdownMenu onOpenChange={() => setSearch('')}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={current ? `Model: ${current.name}` : 'Model'}
          className='flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground disabled:opacity-50 data-[state=open]:text-foreground'
          disabled={disabled || options.length === 0}
          type='button'
        >
          <span className='truncate'>{triggerLabel(current, value)}</span>
          <ChevronDown aria-hidden='true' className='size-4 shrink-0' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='end'
        className='w-72 p-0'
        onCloseAutoFocus={(event) => event.preventDefault()}
        side='top'
        sideOffset={8}
      >
        <div className='sticky top-0 z-10 flex items-center gap-2 border-b bg-popover px-3'>
          <Search
            aria-hidden='true'
            className='size-4 shrink-0 text-muted-foreground'
          />
          <input
            aria-label='Search models'
            className='h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground'
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder='Search models'
            ref={(element) => element?.focus()}
            value={search}
          />
        </div>
        <div className='p-1'>
          {groups.length === 0 && (
            <p className='px-2 py-6 text-center text-sm text-muted-foreground'>
              No models found
            </p>
          )}
          {groups.map(([provider, group]) => (
            <DropdownMenuGroup key={provider}>
              <DropdownMenuLabel className='text-xs text-muted-foreground'>
                {provider}
              </DropdownMenuLabel>
              {group.map((model) => (
                <ModelOption
                  key={`${model.provider}:${model.id}`}
                  current={model === current}
                  model={model}
                  onSelect={onChange}
                  value={value}
                />
              ))}
            </DropdownMenuGroup>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
