import { Check, Copy, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function CopyButton({
  text,
  label = "Copy response",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (status === "idle") {
      return;
    }

    const timeout = window.setTimeout(() => setStatus("idle"), 2500);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const feedback =
    status === "copied"
      ? "Copied"
      : status === "failed"
        ? "Unable to copy. Select the text to copy it."
        : label;

  async function copy() {
    setPending(true);

    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={feedback}
            className={cn("text-muted-foreground", className)}
            disabled={pending || text.length === 0}
            onClick={() => void copy()}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            {status === "copied" ? (
              <Check aria-hidden="true" />
            ) : status === "failed" ? (
              <TriangleAlert aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{feedback}</TooltipContent>
      </Tooltip>
      <span className="sr-only" role="status">
        {status === "idle" ? "" : feedback}
      </span>
    </>
  );
}
