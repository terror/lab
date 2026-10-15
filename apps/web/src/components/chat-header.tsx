import type { ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ChatHeader({
  children,
  title,
  actions,
}: {
  children?: ReactNode;
  title?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background/95 px-3 sm:px-5">
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarTrigger className="size-9 shrink-0 rounded-sm text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent side="bottom">Toggle sidebar</TooltipContent>
      </Tooltip>
      {title && (
        <h1
          className="max-w-[42%] shrink truncate text-base sm:max-w-[45%] sm:text-lg"
          title={title}
        >
          {title}
        </h1>
      )}
      <div className="ml-auto min-w-0 shrink">{children}</div>
      {actions && (
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      )}
    </header>
  );
}
