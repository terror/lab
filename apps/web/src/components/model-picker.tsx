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
import { Slider as SliderPrimitive } from 'radix-ui';
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
    groups.set(model.provider, [...(groups.get(model.provider) ?? []), model]);
  }

  return [...groups];
}

function ThinkingSlider({
  level,
  model,
  onChange,
}: {
  level: ThinkingLevel;
  model: Model;
  onChange: (level: ThinkingLevel) => void;
}) {
  const supported = supportedLevels(model);

  return (
    <div className='mt-1 flex flex-col gap-2.5 border-t px-2 pt-2.5 pb-2'>
      <div className='flex items-center justify-between text-sm'>
        <span className='text-muted-foreground'>Thinking</span>
        <span>{levelLabels[level]}</span>
      </div>
      <SliderPrimitive.Root
        className='relative flex h-4 w-full touch-none items-center select-none'
        max={supported.length - 1}
        min={0}
        onValueChange={([index]) => {
          const next = supported[index ?? 0];

          if (next) {
            onChange(next);
          }
        }}
        step={1}
        value={[supported.indexOf(level)]}
      >
        <SliderPrimitive.Track className='relative h-1 grow overflow-hidden rounded-full bg-muted'>
          <SliderPrimitive.Range className='absolute h-full bg-foreground' />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label='Thinking'
          aria-valuetext={levelLabels[level]}
          className='block size-4 rounded-full bg-white shadow-sm ring-1 ring-foreground/20 transition-shadow outline-none hover:ring-foreground/40 focus-visible:ring-3 focus-visible:ring-ring/50'
        />
      </SliderPrimitive.Root>
    </div>
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
    if (event.defaultPrevented) {
      return;
    }

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
          <span className='truncate'>{triggerLabel(current, value)}</span>
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
          <ThinkingSlider level={level} model={current} onChange={setLevel} />
        )}
      </PopoverContent>
    </Popover>
  );
}
