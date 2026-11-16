import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  type ModelChoice,
  type ThinkingLevel,
  modelsQueryOptions,
} from '@/lib/models';
import { useQuery } from '@tanstack/react-query';
import { Brain, Check, ChevronDown, Image } from 'lucide-react';
import { Fragment } from 'react';

type Model = {
  contextWindow: number;
  id: string;
  images: boolean;
  maxTokens: number;
  name: string;
  provider: string;
  reasoning: boolean;
  thinkingLevels: ThinkingLevel[];
};

const levelLabels: Record<ThinkingLevel, string> = {
  high: 'High',
  low: 'Low',
  max: 'Max',
  medium: 'Medium',
  minimal: 'Minimal',
  off: 'Off',
  xhigh: 'Extra high',
};

function formatTokens(tokens: number) {
  if (tokens >= 1_000_000) {
    return `${Number((tokens / 1_000_000).toFixed(1))}M`;
  }

  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}K`;
  }

  return String(tokens);
}

function groupByProvider(models: Model[]) {
  const groups = new Map<string, Model[]>();

  for (const model of models) {
    groups.set(model.provider, [...(groups.get(model.provider) ?? []), model]);
  }

  return [...groups];
}

function ModelSummary({ active, model }: { active: boolean; model: Model }) {
  return (
    <span className='flex min-w-0 flex-1 items-start gap-2'>
      <Check
        aria-hidden='true'
        className={active ? 'mt-0.5 size-4' : 'invisible mt-0.5 size-4'}
      />
      <span className='flex min-w-0 flex-1 flex-col'>
        <span className='flex items-center gap-1.5'>
          <span className='truncate'>{model.name}</span>
          {model.reasoning && (
            <Brain
              aria-label='Reasoning'
              className='size-3.5 text-muted-foreground'
            />
          )}
          {model.images && (
            <Image
              aria-label='Image input'
              className='size-3.5 text-muted-foreground'
            />
          )}
        </span>
        <span className='text-xs text-muted-foreground'>
          {formatTokens(model.contextWindow)} context ·{' '}
          {formatTokens(model.maxTokens)} output
        </span>
      </span>
    </span>
  );
}

function ModelOption({
  model,
  onChange,
  value,
}: {
  model: Model;
  onChange: (model: ModelChoice) => void;
  value: ModelChoice | undefined;
}) {
  const active = value?.id === model.id;

  if (!model.reasoning || model.thinkingLevels.length <= 1) {
    return (
      <DropdownMenuItem onSelect={() => onChange({ id: model.id })}>
        <ModelSummary active={active} model={model} />
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <ModelSummary active={active} model={model} />
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className='min-w-40'>
        <DropdownMenuLabel className='text-xs text-muted-foreground'>
          Reasoning
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          onValueChange={(level) =>
            onChange({ id: model.id, thinkingLevel: level as ThinkingLevel })
          }
          value={active ? (value.thinkingLevel ?? '') : ''}
        >
          {model.thinkingLevels.map((level) => (
            <DropdownMenuRadioItem key={level} value={level}>
              {levelLabels[level]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function triggerLabel(models: Model[], value: ModelChoice | undefined) {
  if (!value) {
    return 'Model';
  }

  const name = models.find(({ id }) => id === value.id)?.name ?? value.id;

  if (!value.thinkingLevel || value.thinkingLevel === 'off') {
    return name;
  }

  return `${name} · ${levelLabels[value.thinkingLevel]}`;
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className='flex items-center gap-1 text-sm text-muted-foreground outline-none disabled:opacity-50'
          disabled={disabled || options.length === 0}
          type='button'
        >
          {triggerLabel(options, value)}
          <ChevronDown aria-hidden='true' className='size-4' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-72'>
        {groupByProvider(options).map(([provider, group], index) => (
          <Fragment key={provider}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className='text-xs text-muted-foreground'>
              {provider}
            </DropdownMenuLabel>
            {group.map((model) => (
              <ModelOption
                key={model.id}
                model={model}
                onChange={onChange}
                value={value}
              />
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
