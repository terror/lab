import { ArrowUp, LoaderCircle, Square } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type PromptAction =
  | { type: "send"; disabled: boolean; onSubmit: () => void }
  | { type: "sending" }
  | { type: "stop"; disabled: boolean; onStop: () => void }
  | { type: "stopping" };

export function PromptInput({
  action,
  value,
  onValueChange,
  status,
  autoFocus = false,
  placeholder = "Message lab…",
}: {
  action: PromptAction;
  value: string;
  onValueChange: (value: string) => void;
  status: string | undefined;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const compositionTimer = useRef<number | undefined>(undefined);
  const canSubmit = action.type === "send" && !action.disabled;
  const button = buttonState(action);

  useEffect(() => {
    return () => window.clearTimeout(compositionTimer.current);
  }, []);

  useLayoutEffect(() => {
    const element = input.current;

    if (element !== null && element.value === value) {
      element.style.height = "0px";
      element.style.height = `${Math.min(element.scrollHeight, 240)}px`;
    }
  }, [value]);

  useLayoutEffect(() => {
    const element = input.current;

    if (element === null) {
      return;
    }

    let width = element.clientWidth;

    const observer = new ResizeObserver(() => {
      if (width !== element.clientWidth) {
        width = element.clientWidth;
        element.style.height = "0px";
        element.style.height = `${Math.min(element.scrollHeight, 240)}px`;
      }
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (autoFocus) {
      input.current?.focus({ preventScroll: true });
    }
  }, [autoFocus]);

  return (
    <form
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) {
          action.onSubmit();
        }
      }}
    >
      <label className="sr-only" htmlFor={id}>
        Message
      </label>
      <InputGroup className="min-h-16 items-center rounded-sm border-0 bg-card p-2 shadow-none dark:bg-card">
        <InputGroupAddon
          align="inline-start"
          aria-hidden="true"
          className="py-2.5 pr-0 pl-2 font-mono text-base leading-6 font-normal text-primary md:text-sm"
        >
          &gt;
        </InputGroupAddon>
        <InputGroupTextarea
          aria-describedby={`${id}-status`}
          className="max-h-[min(15rem,35dvh)] min-h-11 field-sizing-fixed px-3 py-2.5 font-mono text-base leading-6 outline-none md:text-sm"
          id={id}
          maxLength={100_000}
          onChange={(event) => onValueChange(event.target.value)}
          onCompositionEnd={() => {
            compositionTimer.current = window.setTimeout(() => {
              composing.current = false;
              compositionTimer.current = undefined;
            }, 0);
          }}
          onCompositionStart={() => {
            window.clearTimeout(compositionTimer.current);
            compositionTimer.current = undefined;
            composing.current = true;
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.altKey &&
              !event.nativeEvent.isComposing &&
              !composing.current
            ) {
              event.preventDefault();

              if (canSubmit) {
                event.currentTarget.form?.requestSubmit();
              }
            }
          }}
          placeholder={placeholder}
          ref={input}
          rows={1}
          value={value}
        />
        <InputGroupAddon align="inline-end" className="self-end p-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <InputGroupButton
                  aria-label={button.label}
                  className="size-11 rounded-sm disabled:opacity-40"
                  disabled={button.disabled}
                  onClick={button.onClick}
                  size="icon-sm"
                  type={button.type}
                  variant="default"
                >
                  {button.icon}
                </InputGroupButton>
              </span>
            </TooltipTrigger>
            <TooltipContent>{button.tooltip}</TooltipContent>
          </Tooltip>
        </InputGroupAddon>
      </InputGroup>
      <p
        className="px-3 pt-3 text-center font-mono text-[10px] tracking-wide text-muted-foreground empty:sr-only sm:text-[11px]"
        id={`${id}-status`}
        role="status"
      >
        {status}
      </p>
    </form>
  );
}

function buttonState(action: PromptAction) {
  switch (action.type) {
    case "send":
      return {
        label: "Send message",
        tooltip: "Send message",
        disabled: action.disabled,
        type: "submit" as const,
        icon: <ArrowUp className="size-5" />,
      };
    case "sending":
      return {
        label: "Sending message",
        tooltip: "Send message",
        disabled: true,
        type: "button" as const,
        icon: <LoaderCircle className="size-4 motion-safe:animate-spin" />,
      };
    case "stop":
      return {
        label: "Stop response",
        tooltip: "Stop response",
        disabled: action.disabled,
        type: "button" as const,
        onClick: action.onStop,
        icon: <Square className="size-3.5 fill-current" />,
      };
    case "stopping":
      return {
        label: "Stopping response",
        tooltip: "Stop response",
        disabled: true,
        type: "button" as const,
        icon: <LoaderCircle className="size-4 motion-safe:animate-spin" />,
      };
  }
}
