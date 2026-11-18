import { ProviderLogo } from '@/components/provider-logo';
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
  type ModelKey,
  useFavoriteModels,
  useRecentModels,
} from '@/lib/models';
import { cn } from '@/lib/utils';
import { thinkingLevelSchema } from '@lab/server/schemas';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Search, Star } from 'lucide-react';
import {
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useState,
} from 'react';

const levels = thinkingLevelSchema.options;

const RECENT_LIMIT = 5;

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

function same(a: ModelKey, b: ModelKey) {
  return a.id === b.id && a.provider === b.provider;
}

function focusOnMount(element: HTMLInputElement | null) {
  element?.focus();
}

function FavoriteButton({
  favorite,
  name,
  onToggle,
}: {
  favorite: boolean;
  name: string;
  onToggle: () => void;
}) {
  return (
    <button
      aria-label={favorite ? `Unfavorite ${name}` : `Favorite ${name}`}
      aria-pressed={favorite}
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-opacity hover:text-foreground',
        !favorite &&
          'opacity-0 group-hover/model:opacity-100 group-focus/model:opacity-100'
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      tabIndex={-1}
      type='button'
    >
      <Star
        aria-hidden='true'
        className={cn('size-3.5', favorite && 'fill-current')}
      />
    </button>
  );
}

function ModelOption({
  current,
  favorite,
  model,
  onFavorite,
  onSelect,
  value,
}: {
  current: boolean;
  favorite: boolean;
  model: Model;
  onFavorite: () => void;
  onSelect: (choice: ModelChoice) => void;
  value: ModelChoice | undefined;
}) {
  const label = (
    <>
      <ProviderLogo id={model.provider} name={model.providerName} size='sm' />
      <span className='min-w-0 flex-1 truncate'>{model.name}</span>
      {current && <Check aria-hidden='true' className='size-4' />}
      <FavoriteButton
        favorite={favorite}
        name={model.name}
        onToggle={onFavorite}
      />
    </>
  );

  if (!hasLevels(model)) {
    return (
      <DropdownMenuItem
        className='group/model'
        onSelect={() =>
          onSelect({
            id: model.id,
            provider: model.provider,
            thinkingLevel: 'off',
          })
        }
      >
        {label}
      </DropdownMenuItem>
    );
  }

  const level = current ? currentLevel(model, value) : '';

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className='group/model'>
        {label}
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

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel className='text-xs text-muted-foreground'>
        {title}
      </DropdownMenuLabel>
      {children}
    </DropdownMenuGroup>
  );
}

export function ModelPicker({
  disabled,
  onChange,
  trigger,
  value,
}: {
  disabled?: boolean;
  onChange: (model: ModelChoice) => void;
  trigger?: ReactElement;
  value: ModelChoice | undefined;
}) {
  const models = useQuery(modelsQueryOptions);
  const [search, setSearch] = useState('');
  const [recent, setRecent] = useRecentModels();
  const [favorites, setFavorites] = useFavoriteModels();

  const options = models.data?.models ?? [];

  const current = options.find(
    ({ id, provider }) => id === value?.id && provider === value.provider
  );

  const searching = search.trim().length > 0;

  const resolve = (keys: ModelKey[]) =>
    keys.flatMap((key) => options.filter((model) => same(model, key)));

  const favoriteModels = resolve(favorites);

  const recentModels = resolve(
    recent.filter((key) => !favorites.some((other) => same(key, other)))
  );

  const results = searching
    ? groupByProvider(options.filter((model) => matches(model, search)))
    : [];

  const select = (choice: ModelChoice) => {
    onChange(choice);

    setRecent(
      [choice, ...recent.filter((key) => !same(key, choice))]
        .map(({ id, provider }) => ({ id, provider }))
        .slice(0, RECENT_LIMIT)
    );
  };

  const toggleFavorite = (model: Model) => {
    const key = { id: model.id, provider: model.provider };

    const others = favorites.filter((other) => !same(other, key));

    setFavorites(
      others.length < favorites.length ? others : [...favorites, key]
    );
  };

  const option = (model: Model) => (
    <ModelOption
      key={`${model.provider}:${model.id}`}
      current={model === current}
      favorite={favorites.some((key) => same(key, model))}
      model={model}
      onFavorite={() => toggleFavorite(model)}
      onSelect={select}
      value={value}
    />
  );

  const empty =
    !searching && favoriteModels.length === 0 && recentModels.length === 0;

  return (
    <DropdownMenu onOpenChange={() => setSearch('')}>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <button
            aria-label={current ? `Model: ${current.name}` : 'Model'}
            className='flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground disabled:opacity-50 data-[state=open]:text-foreground'
            disabled={disabled || options.length === 0}
            type='button'
          >
            <span className='truncate'>{triggerLabel(current, value)}</span>
            <ChevronDown aria-hidden='true' className='size-4 shrink-0' />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='end'
        className='w-72 p-0'
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
            placeholder={`Search ${options.length} models`}
            ref={focusOnMount}
            value={search}
          />
        </div>
        <div className='p-1'>
          {searching && results.length === 0 && (
            <p className='px-2 py-6 text-center text-sm text-muted-foreground'>
              No models found
            </p>
          )}
          {!searching && favoriteModels.length > 0 && (
            <Section title='Favorites'>{favoriteModels.map(option)}</Section>
          )}
          {!searching && recentModels.length > 0 && (
            <Section title='Recent'>{recentModels.map(option)}</Section>
          )}
          {empty && current && (
            <Section title='Current'>{option(current)}</Section>
          )}
          {empty && (
            <p className='px-2 py-3 text-xs text-muted-foreground'>
              Search to find any model, and star the ones you use most.
            </p>
          )}
          {results.map(([provider, group]) => (
            <Section key={provider} title={provider}>
              {group.map(option)}
            </Section>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
