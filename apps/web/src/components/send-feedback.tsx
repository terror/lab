import { AlertCircle, ChevronDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { useSend } from "@/hooks/use-send";

export function SendFeedback({
  send,
  disabled,
  canEdit,
  onEdit,
}: {
  send: ReturnType<typeof useSend>;
  disabled: boolean;
  canEdit: boolean;
  onEdit: (content: string) => void;
}) {
  const { operation, error, retry } = send;

  const failure =
    operation?.phase === "uncertain" || operation?.phase === "rejected"
      ? operation
      : undefined;
  const uncertain = failure?.phase === "uncertain";

  if (failure === undefined && error === undefined) {
    return null;
  }

  return (
    <Alert
      className="rounded-sm"
      variant={uncertain ? "default" : "destructive"}
    >
      <AlertCircle />
      <AlertDescription className="w-full gap-2">
        {uncertain && <p>Your message hasn’t been confirmed yet.</p>}
        {failure?.error && <p>{failure.error.message}</p>}
        {error && error.message !== failure?.error?.message && (
          <p>{error.message}</p>
        )}
        {failure !== undefined && (
          <>
            <Button
              className="self-start"
              disabled={uncertain ? disabled : !canEdit}
              onClick={() =>
                uncertain
                  ? retry(failure.requestId)
                  : onEdit(failure.input.content)
              }
              size="sm"
              type="button"
              variant="outline"
            >
              {uncertain
                ? failure.target === "new"
                  ? "Recover chat"
                  : "Check message"
                : "Edit message"}
            </Button>
            <Collapsible className="w-full">
              <CollapsibleTrigger asChild>
                <Button
                  className="h-auto p-0 text-xs text-muted-foreground"
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  View message <ChevronDown className="size-3" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap break-words text-xs">
                {failure.input.content}
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
