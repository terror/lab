import { ProviderLogo } from '@/components/provider-logo';
import { Button } from '@/components/ui/button';
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
import { ListRow } from '@/components/ui/list-row';
import { SectionHeading } from '@/components/ui/section-heading';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { usePhone } from '@/lib/media';
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
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Star,
} from 'lucide-react';
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
          'hover-reveal group-hover/model:opacity-100 group-focus/model:opacity-100'
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

function useModelMenu(
  value: ModelChoice | undefined,
  onChange: (model: ModelChoice) => void
) {
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

  const empty =
    !searching && favoriteModels.length === 0 && recentModels.length === 0;

  const sections = searching
    ? groupByProvider(options.filter((model) => matches(model, search))).map(
        ([title, group]) => ({ models: group, title })
      )
    : [
        { models: favoriteModels, title: 'Favorites' },
        { models: recentModels, title: 'Recent' },
        { models: empty && current ? [current] : [], title: 'Current' },
      ].filter((section) => section.models.length > 0);

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

  return {
    current,
    empty,
    favorite: (model: Model) => favorites.some((key) => same(key, model)),
    options,
    search,
    searching,
    sections,
    select,
    setSearch,
    toggleFavorite,
  };
}

type Picker = {
  menu: ReturnType<typeof useModelMenu>;
  trigger: ReactElement;
  value: ModelChoice | undefined;
};

function SearchField({
  className,
  focus = false,
  menu,
}: {
  className?: string;
  focus?: boolean;
  menu: Picker['menu'];
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b bg-popover px-3',
        className
      )}
    >
      <Search
        aria-hidden='true'
        className='size-4 shrink-0 text-muted-foreground'
      />
      <input
        aria-label='Search models'
        className='h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground'
        onChange={(event) => menu.setSearch(event.target.value)}
        onKeyDown={onSearchKeyDown}
        placeholder={`Search ${menu.options.length} models`}
        ref={focus ? focusOnMount : undefined}
        value={menu.search}
      />
    </div>
  );
}

function Notes({ menu }: { menu: Picker['menu'] }) {
  if (menu.searching && menu.sections.length === 0) {
    return (
      <p className='px-2 py-6 text-center text-sm text-muted-foreground'>
        No models found
      </p>
    );
  }

  if (menu.empty) {
    return (
      <p className='px-2 py-3 text-xs text-muted-foreground'>
        Search to find any model, and star the ones you use most.
      </p>
    );
  }

  return null;
}

function ModelMenu({ menu, trigger, value }: Picker) {
  const option = (model: Model) => (
    <ModelOption
      key={`${model.provider}:${model.id}`}
      current={model === menu.current}
      favorite={menu.favorite(model)}
      model={model}
      onFavorite={() => menu.toggleFavorite(model)}
      onSelect={menu.select}
      value={value}
    />
  );

  return (
    <DropdownMenu onOpenChange={() => menu.setSearch('')}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align='end'
        className='w-72 p-0'
        side='top'
        sideOffset={8}
      >
        <SearchField className='sticky top-0 z-10' focus menu={menu} />
        <div className='p-1'>
          {menu.sections.map(({ models, title }) => (
            <Section key={title} title={title}>
              {models.map(option)}
            </Section>
          ))}
          <Notes menu={menu} />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SheetModels({
  menu,
  onPick,
}: {
  menu: Picker['menu'];
  onPick: (model: Model) => void;
}) {
  return (
    <>
      <SheetHeader className='pb-2'>
        <SheetTitle>Model</SheetTitle>
        <SheetDescription className='sr-only'>
          Choose the model that answers
        </SheetDescription>
      </SheetHeader>
      <SearchField className='border-t' menu={menu} />
      <div className='min-h-0 overflow-y-auto px-4 pt-2 pb-4'>
        {menu.sections.map(({ models, title }) => (
          <section key={title}>
            <SectionHeading>{title}</SectionHeading>
            <ul>
              {models.map((model) => (
                <ListRow
                  key={`${model.provider}:${model.id}`}
                  actions={
                    <Button
                      aria-label={`Favorite ${model.name}`}
                      aria-pressed={menu.favorite(model)}
                      onClick={() => menu.toggleFavorite(model)}
                      size='icon-sm'
                      variant='quiet'
                    >
                      <Star
                        aria-hidden='true'
                        className={cn(menu.favorite(model) && 'fill-current')}
                      />
                    </Button>
                  }
                  asChild
                >
                  <button
                    aria-current={model === menu.current ? 'true' : undefined}
                    onClick={() => onPick(model)}
                    type='button'
                  >
                    <ProviderLogo
                      id={model.provider}
                      name={model.providerName}
                      size='sm'
                    />
                    <span className='min-w-0 flex-1 truncate'>
                      {model.name}
                    </span>
                    {model === menu.current && (
                      <Check aria-hidden='true' className='size-4' />
                    )}
                    {hasLevels(model) && (
                      <ChevronRight
                        aria-hidden='true'
                        className='size-4 text-muted-foreground'
                      />
                    )}
                  </button>
                </ListRow>
              ))}
            </ul>
          </section>
        ))}
        <Notes menu={menu} />
      </div>
    </>
  );
}

function SheetLevels({
  current,
  model,
  onBack,
  onChoose,
  value,
}: {
  current: Model | undefined;
  model: Model;
  onBack: () => void;
  onChoose: (level: ThinkingLevel) => void;
  value: ModelChoice | undefined;
}) {
  const selected = model === current ? currentLevel(model, value) : undefined;

  return (
    <>
      <SheetHeader className='flex-row items-center gap-2 pb-2'>
        <Button
          aria-label='Back'
          onClick={onBack}
          size='icon-sm'
          variant='quiet'
        >
          <ChevronLeft aria-hidden='true' />
        </Button>
        <SheetTitle>{model.name}</SheetTitle>
        <SheetDescription className='sr-only'>
          Choose how much {model.name} thinks
        </SheetDescription>
      </SheetHeader>
      <div className='px-4 pb-4'>
        <SectionHeading>Thinking</SectionHeading>
        <ul>
          {supportedLevels(model).map((level) => (
            <ListRow key={level} asChild>
              <button
                aria-current={level === selected ? 'true' : undefined}
                onClick={() => onChoose(level)}
                type='button'
              >
                <span className='flex-1'>{levelLabels[level]}</span>
                {level === selected && (
                  <Check aria-hidden='true' className='size-4' />
                )}
              </button>
            </ListRow>
          ))}
        </ul>
      </div>
    </>
  );
}

function ModelSheet({ menu, trigger, value }: Picker) {
  const [open, setOpen] = useState(false);
  const [leveled, setLeveled] = useState<Model>();

  const choose = (choice: ModelChoice) => {
    menu.select(choice);
    setOpen(false);
  };

  const pick = (model: Model) => {
    if (hasLevels(model)) {
      setLeveled(model);
      return;
    }

    choose({ id: model.id, provider: model.provider, thinkingLevel: 'off' });
  };

  return (
    <Sheet
      onOpenChange={(next) => {
        setOpen(next);
        setLeveled(undefined);
        menu.setSearch('');
      }}
      open={open}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        className='max-h-4/5 gap-0 rounded-t-dialog'
        onOpenAutoFocus={(event) => event.preventDefault()}
        showCloseButton={false}
        side='bottom'
      >
        {leveled && (
          <SheetLevels
            current={menu.current}
            model={leveled}
            onBack={() => setLeveled(undefined)}
            onChoose={(thinkingLevel) =>
              choose({
                id: leveled.id,
                provider: leveled.provider,
                thinkingLevel,
              })
            }
            value={value}
          />
        )}
        {!leveled && <SheetModels menu={menu} onPick={pick} />}
      </SheetContent>
    </Sheet>
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
  const menu = useModelMenu(value, onChange);
  const phone = usePhone();

  const Picker = phone ? ModelSheet : ModelMenu;

  return (
    <Picker
      menu={menu}
      trigger={
        trigger ?? (
          <Button
            aria-label={menu.current ? `Model: ${menu.current.name}` : 'Model'}
            className='min-w-0 shrink font-normal'
            disabled={disabled || menu.options.length === 0}
            type='button'
            variant='quiet'
          >
            <span className='truncate'>
              {triggerLabel(menu.current, value)}
            </span>
            <ChevronDown aria-hidden='true' data-icon='inline-end' />
          </Button>
        )
      }
      value={value}
    />
  );
}
