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
  const [status, setStatus] = useState<
    "idle" | "copying" | "copied" | "failed"
  >("idle");

  useEffect(() => {
    if (status === "idle" || status === "copying") {
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
    setStatus("copying");

    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={feedback}
            className={cn("text-muted-foreground", className)}
            disabled={status === "copying" || text.length === 0}
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
        {status === "copied" || status === "failed" ? feedback : ""}
      </span>
    </>
  );
}
