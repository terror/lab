import type { ToolProgress } from "@lab/wire";
import {
  Check,
  ChevronDown,
  CircleAlert,
  CircleDashed,
  ExternalLink,
  LoaderCircle,
  Pause,
} from "lucide-react";
import { memo } from "react";
import { CopyButton } from "@/components/copy-button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { describeTool } from "@/lib/tool-display";
import { cn } from "@/lib/utils";

export const ToolActivity = memo(function ToolActivity({
  calls,
  stale,
}: {
  calls: ToolProgress[];
  stale: boolean;
}) {
  const presentation = describeGroup(calls, stale);

  if (presentation === undefined) {
    return null;
  }

  const Icon = presentation.icon;

  return (
    <Collapsible className="min-w-0 font-sans">
      <span className="sr-only" role="status">
        {presentation.label}
        {presentation.subject ? `: ${presentation.subject}` : ""}
      </span>
      <CollapsibleTrigger asChild>
        <button
          className="group/activity -ml-2 flex min-h-10 max-w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left font-sans text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          type="button"
        >
          <Icon
            aria-hidden="true"
            className={cn("size-4 shrink-0", presentation.iconClassName)}
          />
          <span className="min-w-0 truncate">
            <span>{presentation.label}</span>
            {presentation.subject && (
              <span className="ml-2 text-muted-foreground/75">
                {presentation.subject}
              </span>
            )}
          </span>
          {presentation.count !== undefined && (
            <span className="shrink-0 rounded-full bg-muted/60 px-1.5 text-[11px] tabular-nums">
              {presentation.count}
              <span className="sr-only"> steps</span>
            </span>
          )}
          {presentation.duration !== undefined && (
            <span className="shrink-0 text-xs text-muted-foreground/70 tabular-nums">
              {presentation.duration}
            </span>
          )}
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-data-[state=open]/activity:rotate-180 motion-reduce:transition-none"
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="mt-1 mb-2 ml-2 space-y-2 border-l border-border/60 pl-5">
          {calls.map((call) => (
            <ActivityStep call={call} key={call.callId} stale={stale} />
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
});

const ActivityStep = memo(function ActivityStep({
  call,
  stale,
}: {
  call: ToolProgress;
  stale: boolean;
}) {
  const presentation = describeTool(call);

  const pending = call.status === "pending" || call.status === "running";

  const state = {
    pending: {
      icon: CircleDashed,
      label: stale ? "Last received" : "Queued",
      empty: stale ? "Waiting to reconnect…" : "Waiting for output…",
    },
    running: {
      icon: stale ? CircleDashed : LoaderCircle,
      label: stale ? "Last received" : "Running",
      empty: stale ? "Waiting to reconnect…" : "Waiting for output…",
    },
    succeeded: {
      icon: presentation.icon,
      label: "Done",
      empty: "Completed without text output.",
    },
    failed: {
      icon: CircleAlert,
      label: "Failed",
      empty: "No error details were returned.",
    },
    interrupted: {
      icon: Pause,
      label: "Interrupted",
      empty: "No result was recorded.",
    },
  }[call.status];

  const Icon = state.icon;

  const output =
    call.output ||
    (call.details === undefined ? "" : JSON.stringify(call.details, null, 2));

  return (
    <li className="relative min-w-0 py-1">
      <Icon
        aria-hidden="true"
        className={cn(
          "absolute top-3 -left-7 size-4 bg-background text-muted-foreground",
          call.status === "running" && !stale && "motion-safe:animate-spin",
          call.status === "failed" && "text-destructive",
        )}
      />
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button
            className="group/step flex min-h-9 w-full items-center gap-2 rounded-lg py-1 text-left font-sans text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            type="button"
          >
            <span className="min-w-0 flex-1 truncate">
              {presentation.label}
            </span>
            <span
              className={cn(
                "shrink-0 text-xs text-muted-foreground",
                call.status === "failed" && "text-destructive",
              )}
            >
              {state.label}
            </span>
            {(call.status === "succeeded" || call.status === "failed") &&
              call.durationMs !== undefined && (
                <span className="shrink-0 text-xs text-muted-foreground/70 tabular-nums">
                  {duration(call.durationMs)}
                </span>
              )}
            <ChevronDown
              aria-hidden="true"
              className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-data-[state=open]/step:rotate-180 motion-reduce:transition-none"
            />
            <span className="sr-only">View input and output</span>
          </button>
        </CollapsibleTrigger>
        {presentation.subject && (
          <p className="truncate text-xs leading-6 text-muted-foreground">
            {presentation.url ? (
              <a
                className="inline-flex max-w-full items-center gap-1 rounded-sm hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                href={presentation.url.href}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span className="truncate">{presentation.subject}</span>
                <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
              </a>
            ) : (
              presentation.subject
            )}
          </p>
        )}
        {presentation.preview &&
          presentation.preview !== presentation.subject && (
            <p
              className={cn(
                "line-clamp-2 text-xs leading-5 break-words text-muted-foreground/80",
                call.status === "failed" && "text-destructive",
              )}
            >
              {presentation.preview}
            </p>
          )}
        <CollapsibleContent>
          <div className="mt-3 overflow-hidden rounded-xl border border-border/50 bg-card/60">
            <div className="border-b border-border/40 px-3 py-2 font-mono text-[11px] text-muted-foreground">
              {call.name}
            </div>
            {call.arguments !== undefined && (
              <DetailSection
                label="Input"
                name={call.name}
                text={JSON.stringify(call.arguments, null, 2)}
              />
            )}
            <DetailSection
              empty={state.empty}
              label={pending ? "Progress" : "Output"}
              name={call.name}
              text={output}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
});

function DetailSection({
  empty,
  label,
  name,
  text,
}: {
  empty?: string;
  label: string;
  name: string;
  text: string;
}) {
  return (
    <div className="border-b border-border/40 last:border-b-0">
      <div className="flex items-center justify-between px-3 pt-1 text-xs text-muted-foreground">
        <span>{label}</span>
        <CopyButton label={`Copy ${name} ${label.toLowerCase()}`} text={text} />
      </div>
      <ScrollArea
        viewportProps={{
          "aria-label": `${name} ${label.toLowerCase()}`,
          className: "max-h-64",
          role: "region",
          tabIndex: 0,
        }}
      >
        <pre className="px-3 pt-1 pb-3 font-mono text-xs leading-5 whitespace-pre-wrap break-words">
          {text || empty}
        </pre>
      </ScrollArea>
    </div>
  );
}

function describeGroup(calls: ToolProgress[], stale: boolean) {
  const active =
    calls.find((call) => call.status === "running") ??
    calls.find((call) => call.status === "pending");

  const current = active ?? calls.at(-1);

  if (current === undefined) {
    return undefined;
  }

  const presentation = describeTool(current);

  if (active) {
    const running = active.status === "running" && !stale;

    return {
      label: `${stale ? "Last activity: " : ""}${presentation.label}${active.status === "pending" ? " · Queued" : ""}`,
      subject: presentation.subject,
      icon: running ? LoaderCircle : CircleDashed,
      iconClassName: running ? "motion-safe:animate-spin" : undefined,
      count: calls.length > 1 ? calls.length : undefined,
    };
  }

  const single = calls.length === 1;

  const subject = single ? presentation.subject : undefined;

  const elapsed =
    single &&
    (current.status === "succeeded" || current.status === "failed") &&
    current.durationMs !== undefined
      ? duration(current.durationMs)
      : undefined;

  const failed = calls.filter((call) => call.status === "failed").length;

  if (failed > 0) {
    return {
      label: `${failed} ${failed === 1 ? "step" : "steps"} failed`,
      subject,
      icon: CircleAlert,
      iconClassName: "text-destructive",
      duration: elapsed,
    };
  }

  if (calls.some((call) => call.status === "interrupted")) {
    return {
      label: "Activity interrupted",
      subject,
      icon: Pause,
    };
  }

  if (single) {
    return {
      label: presentation.label,
      subject,
      icon: presentation.icon,
      duration: elapsed,
    };
  }

  return {
    label: `Completed ${calls.length} steps`,
    icon: Check,
  };
}

function duration(milliseconds: number) {
  if (milliseconds < 1000) {
    return "<1s";
  }

  if (milliseconds < 60_000) {
    return `${(milliseconds / 1000).toFixed(milliseconds < 10_000 ? 1 : 0)}s`;
  }

  return `${Math.floor(milliseconds / 60_000)}m ${Math.floor((milliseconds % 60_000) / 1000)}s`;
}
