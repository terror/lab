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

const levelHints: Record<ThinkingLevel, string> = {
  high: 'Deeper',
  low: 'Quick',
  max: 'Most thorough',
  medium: 'Balanced',
  minimal: 'Quick',
  off: 'Answers right away',
  xhigh: 'Deeper',
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

function price(value: number) {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

function tokens(value: number) {
  if (value >= 1_000_000) {
    return `${Math.round(value / 100_000) / 10}M`;
  }

  return `${Math.round(value / 1_000)}K`;
}

function facts(model: Model) {
  return `${price(model.cost.input)} / ${price(model.cost.output)} per M · ${tokens(model.contextWindow)} context`;
}

function groupByProvider(models: Model[]) {
  const groups = new Map<string, Model[]>();

  for (const model of models) {
    groups.set(model.provider, [...(groups.get(model.provider) ?? []), model]);
  }

  return [...groups];
}

function LevelGlyph({ level, model }: { level: ThinkingLevel; model: Model }) {
  const index = levels.indexOf(level);

  return (
    <span aria-hidden='true' className='flex h-3.5 items-end gap-px'>
      {efforts
        .filter((effort) => model.thinkingLevels.includes(effort))
        .map((effort, position) => (
          <span
            key={effort}
            className={cn(
              'w-[2.5px] rounded-[1px] transition-colors',
              levels.indexOf(effort) <= index
                ? 'bg-foreground/75'
                : 'bg-foreground/25'
            )}
            style={{ height: 4 + position * 2 }}
          />
        ))}
    </span>
  );
}

function ThinkingMeter({
  level,
  model,
  onChange,
}: {
  level: ThinkingLevel;
  model: Model;
  onChange: (level: ThinkingLevel) => void;
}) {
  const index = levels.indexOf(level);

  return (
    <fieldset className='flex items-center justify-between gap-3 px-2.5 py-2'>
      <legend className='sr-only'>Thinking for {model.name}</legend>
      <div className='flex min-w-0 flex-col'>
        <span className='text-[11px] font-semibold tracking-wide text-muted-foreground uppercase'>
          Thinking
        </span>
        <span className='truncate text-sm font-semibold'>
          {levelLabels[level]}
          <span className='ml-1.5 text-xs font-normal text-muted-foreground'>
            {levelHints[level]}
          </span>
        </span>
      </div>
      <div className='flex shrink-0 items-center gap-1.5'>
        <button
          aria-label='Thinking off'
          aria-pressed={level === 'off'}
          className={cn(
            'h-6.5 rounded-[7px] border px-2 text-xs transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
            level === 'off'
              ? 'border-foreground font-semibold text-foreground'
              : 'border-border text-muted-foreground'
          )}
          onClick={() => onChange('off')}
          type='button'
        >
          Off
        </button>
        <div className='flex items-end gap-0.5'>
          {efforts.map((effort, position) => {
            const available = model.thinkingLevels.includes(effort);
            const filled = available && levels.indexOf(effort) <= index;

            return (
              <button
                key={effort}
                aria-label={`Thinking ${levelLabels[effort]}`}
                aria-pressed={effort === level}
                className='group/bar flex h-9 w-4.5 items-end justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed'
                disabled={!available}
                onClick={() => onChange(effort)}
                type='button'
              >
                <span
                  className={cn(
                    'w-2 rounded-[2px] transition-colors duration-150',
                    filled && 'bg-foreground',
                    !filled &&
                      available &&
                      'bg-foreground/20 group-hover/bar:bg-foreground/40',
                    !available && 'border border-dashed border-foreground/25'
                  )}
                  style={{ height: 8 + position * 4 }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}

function ModelRow({
  model,
  onSelect,
  selected,
}: {
  model: Model;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <button
      aria-current={selected ? 'true' : undefined}
      className='flex min-h-11 w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left transition-colors outline-none hover:bg-accent focus-visible:bg-accent'
      data-model-row
      onClick={onSelect}
      type='button'
    >
      <span
        aria-hidden='true'
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition-colors',
          selected
            ? 'bg-foreground text-background'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {model.provider.charAt(0)}
      </span>
      <span className='flex min-w-0 flex-1 flex-col'>
        <span className='truncate text-sm font-medium'>{model.name}</span>
        <span className='truncate text-xs text-muted-foreground tabular-nums'>
          {facts(model)}
        </span>
      </span>
      {selected && (
        <Check
          aria-hidden='true'
          className='size-4 shrink-0'
          strokeWidth={2.25}
        />
      )}
    </button>
  );
}

function Key({ children }: { children: string }) {
  return (
    <kbd className='inline-flex h-4 min-w-4 items-center justify-center rounded border bg-muted px-1 font-sans text-[10px]'>
      {children}
    </kbd>
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
  const current = options.find(({ id }) => id === value?.id);
  const level = current && currentLevel(current, value);

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
          className='flex h-8 min-w-0 items-center gap-2 rounded-full px-2.5 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 data-[state=open]:bg-accent data-[state=open]:text-foreground'
          disabled={disabled || options.length === 0}
          type='button'
        >
          <span className='truncate'>
            {current?.name ?? value?.id ?? 'Model'}
          </span>
          {current && level && hasLevels(current) && (
            <LevelGlyph level={level} model={current} />
          )}
          <ChevronDown aria-hidden='true' className='size-4 shrink-0' />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align='end'
        className='w-85 max-w-[calc(100vw-2rem)] gap-0 rounded-2xl p-1.5'
        onKeyDown={onKeyDown}
        side='top'
        sideOffset={8}
      >
        <div className='flex items-baseline justify-between px-2.5 pt-1.5 pb-1'>
          <span className='text-[13px] font-semibold'>Model</span>
          <span className='text-[11px] text-muted-foreground'>
            Also used for new chats
          </span>
        </div>
        {groupByProvider(options).map(([provider, group]) => (
          <fieldset key={provider}>
            <legend className='w-full px-2.5 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase'>
              {provider}
            </legend>
            {group.map((model) => (
              <ModelRow
                key={model.id}
                model={model}
                onSelect={() => select(model)}
                selected={model.id === current?.id}
              />
            ))}
          </fieldset>
        ))}
        {current && level && hasLevels(current) && (
          <>
            <div className='mx-1 my-1.5 h-px bg-border' />
            <ThinkingMeter level={level} model={current} onChange={setLevel} />
          </>
        )}
        <div className='mt-1 flex items-center gap-3 border-t px-2.5 pt-2 pb-1 text-[11px] text-muted-foreground'>
          <span className='flex items-center gap-1'>
            <Key>↑</Key>
            <Key>↓</Key>
            model
          </span>
          <span className='flex items-center gap-1'>
            <Key>←</Key>
            <Key>→</Key>
            thinking
          </span>
          <span className='flex items-center gap-1'>
            <Key>↵</Key>
            done
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
