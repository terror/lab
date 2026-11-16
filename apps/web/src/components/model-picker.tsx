import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  type Model,
  type ModelChoice,
  type ThinkingLevel,
  modelsQueryOptions,
} from '@/lib/models';
import { cn } from '@/lib/utils';
import { thinkingLevelSchema } from '@lab/server/schemas';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';

const levels = thinkingLevelSchema.options;

const efforts = levels.filter((level) => level !== 'off');

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

function groupByProvider(models: Model[]) {
  const groups = new Map<string, Model[]>();

  for (const model of models) {
    groups.set(model.provider, [...(groups.get(model.provider) ?? []), model]);
  }

  return [...groups];
}

function Bars({
  level,
  model,
  onChange,
}: {
  level: ThinkingLevel;
  model: Model;
  onChange?: (level: ThinkingLevel) => void;
}) {
  const index = levels.indexOf(level);

  const available = efforts.filter((effort) =>
    model.thinkingLevels.includes(effort)
  );

  if (!onChange) {
    return (
      <span aria-hidden='true' className='flex h-3 items-end gap-px'>
        {available.map((effort, position) => (
          <span
            key={effort}
            className={cn(
              'w-0.5 rounded-full',
              levels.indexOf(effort) <= index
                ? 'bg-current'
                : 'bg-foreground/20'
            )}
            style={{ height: 4 + position * 1.5 }}
          />
        ))}
      </span>
    );
  }

  return (
    <span className='flex items-end'>
      {available.map((effort, position) => (
        <button
          key={effort}
          aria-label={`Thinking ${levelLabels[effort]}`}
          aria-pressed={effort === level}
          className='group/bar flex h-6 w-3 items-end justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
          onClick={() => onChange(effort === level ? 'off' : effort)}
          type='button'
        >
          <span
            className={cn(
              'w-1 rounded-full transition-colors',
              levels.indexOf(effort) <= index
                ? 'bg-foreground'
                : 'bg-foreground/15 group-hover/bar:bg-foreground/35'
            )}
            style={{ height: 6 + position * 3 }}
          />
        </button>
      ))}
    </span>
  );
}

function moveFocus(container: HTMLElement, step: number) {
  const rows = [
    ...container.querySelectorAll<HTMLButtonElement>('[data-model-row]'),
  ];

  const index = rows.findIndex((row) => row === document.activeElement);

  rows[Math.max(0, Math.min(rows.length - 1, index + step))]?.focus();
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
  const [open, setOpen] = useState(false);

  const options = models.data ?? [];
  const groups = groupByProvider(options);
  const current = options.find(({ id }) => id === value?.id);
  const level = current && currentLevel(current, value);
  const thinking = current && level && hasLevels(current);

  const setLevel = (next: ThinkingLevel) => {
    if (current) {
      onChange({ id: current.id, thinkingLevel: clamp(current, next) });
    }
  };

  const select = (model: Model) => {
    if (model.id === current?.id) {
      setOpen(false);
      return;
    }

    onChange({ id: model.id, thinkingLevel: currentLevel(model, value) });
  };

  const stepLevel = (step: number) => {
    if (!current || !level) {
      return;
    }

    const supported = supportedLevels(current);

    const next = supported[supported.indexOf(level) + step];

    if (next) {
      setLevel(next);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, () => void> = {
      ArrowDown: () => moveFocus(event.currentTarget, 1),
      ArrowLeft: () => stepLevel(-1),
      ArrowRight: () => stepLevel(1),
      ArrowUp: () => moveFocus(event.currentTarget, -1),
    };

    const step = steps[event.key];

    if (step) {
      event.preventDefault();
      step();
    }
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label={current ? `Model: ${current.name}` : 'Model'}
          className='flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground disabled:opacity-50 data-[state=open]:text-foreground'
          disabled={disabled || options.length === 0}
          type='button'
        >
          <span className='truncate'>
            {current?.name ?? value?.id ?? 'Model'}
          </span>
          {thinking && <Bars level={level} model={current} />}
          <ChevronDown aria-hidden='true' className='size-4 shrink-0' />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align='end'
        className='w-60 gap-0 rounded-xl p-1'
        onKeyDown={onKeyDown}
        side='top'
        sideOffset={8}
      >
        {groups.map(([provider, group]) => (
          <fieldset key={provider}>
            <legend
              className={cn(
                'px-2 pt-1.5 pb-1 text-xs text-muted-foreground',
                groups.length === 1 && 'sr-only'
              )}
            >
              {provider}
            </legend>
            {group.map((model) => (
              <button
                key={model.id}
                aria-current={model.id === current?.id ? 'true' : undefined}
                className='flex h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent'
                data-model-row
                onClick={() => select(model)}
                type='button'
              >
                <span className='truncate'>{model.name}</span>
                {model.id === current?.id && (
                  <Check aria-hidden='true' className='size-4 shrink-0' />
                )}
              </button>
            ))}
          </fieldset>
        ))}
        {thinking && (
          <div className='mt-1 flex h-9 items-center justify-between border-t px-2 pt-1'>
            <span className='text-sm'>
              <span className='text-muted-foreground'>Thinking</span>{' '}
              {levelLabels[level]}
            </span>
            <Bars level={level} model={current} onChange={setLevel} />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
