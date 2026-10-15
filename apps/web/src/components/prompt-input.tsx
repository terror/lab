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

export function PromptInput({
  value,
  onValueChange,
  onSubmit,
  canSubmit,
  submitting = false,
  working = false,
  onStop,
  canStop = false,
  stopping = false,
  status,
  autoFocus = false,
  placeholder = "Message lab…",
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  submitting?: boolean;
  working?: boolean;
  onStop?: () => void;
  canStop?: boolean;
  stopping?: boolean;
  status?: string;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const showStop = (working || stopping) && onStop !== undefined;

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
          onSubmit();
        }
      }}
    >
      <label className="sr-only" htmlFor={id}>
        Message
      </label>
      <InputGroup className="panel-frame min-h-16 items-end rounded-sm border-input bg-composer p-2 shadow-none transition-colors dark:bg-composer">
        <InputGroupAddon
          align="inline-start"
          aria-hidden="true"
          className="self-start py-2.5 pr-0 pl-2 font-mono text-base text-primary"
        >
          &gt;
        </InputGroupAddon>
        <InputGroupTextarea
          aria-describedby={`${id}-status`}
          className="max-h-[min(15rem,35dvh)] min-h-11 field-sizing-fixed px-3 py-2.5 font-mono text-base leading-6 outline-none md:text-sm"
          id={id}
          maxLength={100_000}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.altKey &&
              !event.nativeEvent.isComposing &&
              event.nativeEvent.keyCode !== 229
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
                  aria-label={
                    showStop
                      ? stopping
                        ? "Stopping response"
                        : "Stop response"
                      : submitting
                        ? "Sending message"
                        : "Send message"
                  }
                  className="size-11 rounded-sm disabled:opacity-40"
                  disabled={showStop ? !canStop || stopping : !canSubmit}
                  onClick={showStop ? onStop : undefined}
                  size="icon-sm"
                  type={showStop ? "button" : "submit"}
                  variant="default"
                >
                  {stopping || submitting ? (
                    <LoaderCircle className="size-4 motion-safe:animate-spin" />
                  ) : showStop ? (
                    <Square className="size-3.5 fill-current" />
                  ) : (
                    <ArrowUp className="size-5" />
                  )}
                </InputGroupButton>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {showStop ? "Stop response" : "Send message"}
            </TooltipContent>
          </Tooltip>
        </InputGroupAddon>
      </InputGroup>
      <p
        className="min-h-7 px-3 pt-3 text-center font-mono text-[10px] tracking-wide text-muted-foreground sm:text-[11px]"
        id={`${id}-status`}
        role="status"
      >
        {status ?? (
          <span className="hidden sm:inline">Shift + Enter for a new line</span>
        )}
      </p>
    </form>
  );
}
