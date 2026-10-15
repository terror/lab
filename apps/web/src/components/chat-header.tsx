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
    <header className="flex h-14 shrink-0 items-center gap-2 px-3 sm:px-5">
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarTrigger className="size-9 shrink-0 rounded-lg text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent side="bottom">Toggle sidebar</TooltipContent>
      </Tooltip>
      {title && (
        <h1
          className="max-w-[42%] shrink truncate text-sm font-medium sm:max-w-[45%]"
          title={title}
        >
          {title}
        </h1>
      )}
      <div className="min-w-0 shrink">{children}</div>
      {actions && (
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {actions}
        </div>
      )}
    </header>
  );
}
