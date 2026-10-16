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

  const uncertain = operation?.phase === "uncertain";
  const rejected =
    operation?.phase === "complete" && operation.error !== undefined;

  if (!uncertain && !rejected && error === undefined) {
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
        {operation?.error && <p>{operation.error.message}</p>}
        {error && error.message !== operation?.error?.message && (
          <p>{error.message}</p>
        )}
        {operation !== undefined && (uncertain || rejected) && (
          <>
            <Button
              className="self-start"
              disabled={uncertain ? disabled : !canEdit}
              onClick={() =>
                uncertain
                  ? retry(operation.input.requestId)
                  : onEdit(operation.input.content)
              }
              size="sm"
              type="button"
              variant="outline"
            >
              {uncertain
                ? operation.conversationId === undefined
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
                {operation.input.content}
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
