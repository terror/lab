import type { useModels } from "@lab/client/react";
import type { ModelReference } from "@lab/wire";
import {
  CheckIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { modelAvailable, modelKey } from "@/lib/models";
import { cn } from "@/lib/utils";

export function ModelPicker({
  models,
  value,
  onChange,
  disabled = false,
  pending = false,
  className,
}: {
  models: ReturnType<typeof useModels>;
  value: ModelReference | undefined;
  onChange: (model: ModelReference) => void;
  disabled?: boolean;
  pending?: boolean;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const provider = models.data?.providers.find(
    (provider) => provider.id === value?.provider,
  );
  const model = provider?.models.find((model) => model.id === value?.modelId);
  const providers = (models.data?.providers ?? [])
    .map((provider) => ({
      ...provider,
      models: provider.models
        .filter(
          (model) =>
            (provider.available && model.available) ||
            (provider.id === value?.provider && model.id === value.modelId),
        )
        .sort(
          (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
        ),
    }))
    .filter((provider) => provider.models.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const available = providers.some(
    (provider) =>
      provider.available && provider.models.some((model) => model.available),
  );
  const unavailable =
    value !== undefined &&
    models.data !== undefined &&
    !modelAvailable(models.data, value);
  const name = model?.name || value?.modelId || "Choose a model";
  const providerName = provider?.name || value?.provider;
  const label = value === undefined ? name : `${providerName}:${name}`;
  const error = models.error?.message ?? provider?.error?.message;
  const canChoose = !disabled && !pending && !models.stale;
  const status = !models.connected
    ? "Reconnect to change models."
    : pending
      ? "Changing model…"
      : models.isFetching && models.data === undefined
        ? "Loading your Pi models…"
        : models.data === undefined
          ? "Your models could not be loaded. Try refreshing."
          : !available
            ? "No models available. Check your Pi credentials, then refresh."
            : unavailable
              ? "Your selected model is unavailable. Choose another or refresh."
              : disabled
                ? "Model changes are temporarily unavailable."
                : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          aria-label={
            value === undefined
              ? "Choose a model"
              : `Choose a model. Current: ${label}${unavailable ? ", unavailable" : ""}${pending ? ", changing model" : ""}`
          }
          className={cn(
            "h-9 min-w-0 max-w-full gap-2 rounded-sm border border-border bg-card/60 px-3 font-mono text-xs font-normal",
            className,
          )}
          title={value === undefined ? undefined : label}
          type="button"
          variant="ghost"
        >
          <span className="min-w-0 truncate">{name}</span>
          {pending ? (
            <LoaderCircleIcon
              aria-hidden="true"
              className="motion-safe:animate-spin"
            />
          ) : unavailable ? (
            <CircleAlertIcon aria-hidden="true" className="text-destructive" />
          ) : (
            <ChevronDownIcon
              aria-hidden="true"
              className="text-muted-foreground"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label="Choose a model"
        className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-sm p-0 shadow-lg"
        sideOffset={8}
      >
        <Command
          className="**:data-[slot=command-input-wrapper]:h-12"
          label="Choose a model"
        >
          <CommandInput
            aria-describedby={status || error ? `${id}-status` : undefined}
            aria-label="Search models and providers"
            className="h-12"
            placeholder="Search models and providers…"
          />
          <CommandList className="max-h-[min(22rem,45svh)] p-1">
            <CommandEmpty>
              {models.isFetching && models.data === undefined
                ? "Loading models…"
                : available
                  ? "No matching models."
                  : "No models available."}
            </CommandEmpty>
            {value !== undefined && model === undefined && (
              <CommandGroup heading="Current model">
                <CommandItem
                  disabled
                  keywords={[value.provider, value.modelId]}
                  value={modelKey(value)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{value.modelId}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {`${value.provider}:${value.modelId}`}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {models.data === undefined ? "Not loaded" : "Unavailable"}
                    </p>
                  </div>
                  <CheckIcon aria-hidden="true" />
                </CommandItem>
              </CommandGroup>
            )}
            {providers.map((provider) => (
              <CommandGroup
                heading={provider.name || provider.id}
                key={provider.id}
              >
                {provider.models.map((model) => {
                  const reference = {
                    provider: provider.id,
                    modelId: model.id,
                  };
                  const selected = modelKey(reference) === modelKey(value);
                  const available = provider.available && model.available;

                  return (
                    <CommandItem
                      className="gap-3 rounded-sm px-3 py-2.5"
                      disabled={!canChoose || !available}
                      key={model.id}
                      keywords={[
                        provider.id,
                        provider.name,
                        model.name,
                        model.id,
                      ]}
                      onSelect={() => {
                        if (canChoose && available) {
                          if (!selected) {
                            onChange(reference);
                          }

                          setOpen(false);
                        }
                      }}
                      value={modelKey(reference)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{model.name || model.id}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {`${provider.id}:${model.id}`}
                        </p>
                        {!available && (
                          <p className="text-xs text-muted-foreground">
                            Unavailable
                          </p>
                        )}
                      </div>
                      {selected && (
                        <>
                          <span className="sr-only">Current model</span>
                          <CheckIcon aria-hidden="true" />
                        </>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
        {(error || status) && (
          <div
            className="space-y-1 border-t px-4 py-3 text-xs"
            id={`${id}-status`}
          >
            {error && (
              <p className="text-destructive" role="alert">
                {error}
              </p>
            )}
            {status && (
              <p className="text-muted-foreground" role="status">
                {status}
              </p>
            )}
          </div>
        )}
        <div className="flex items-center gap-3 border-t px-4 py-3">
          <p className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">
            Changes apply to the next model request.
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Refresh models from Pi configuration"
                disabled={models.isFetching || !models.connected}
                onClick={() => void models.refresh()}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <RefreshCwIcon
                  aria-hidden="true"
                  className={cn(
                    models.isFetching && "motion-safe:animate-spin",
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh Pi models</TooltipContent>
          </Tooltip>
        </div>
      </PopoverContent>
    </Popover>
  );
}
