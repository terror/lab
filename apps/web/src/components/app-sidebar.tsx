import {
  useConnection,
  useConversations,
  usePendingRequests,
} from "@lab/client/react";
import {
  ChevronsUpDown,
  CircleUserRound,
  FlaskConical,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  Search,
  SquarePen,
  Sun,
  SunMoon,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function AppSidebar({
  session,
}: {
  session: ReturnType<typeof useSession>;
}) {
  const location = useLocation();
  const connection = useConnection();
  const conversations = useConversations();
  const pending = usePendingRequests();
  const { isMobile, setOpenMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const [search, setSearch] = useState("");
  const previousLocation = useRef(location.key);
  const connected = connection.status === "connected";
  const items = conversations.items?.filter((conversation) =>
    conversation.title
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );

  useEffect(() => {
    if (previousLocation.current !== location.key) {
      previousLocation.current = location.key;
      setOpenMobile(false);
    }
  }, [location.key, setOpenMobile]);

  return (
    <Sidebar
      className="h-full w-full border-0"
      collapsible={isMobile ? "offcanvas" : "none"}
    >
      <SidebarHeader className="gap-3 px-3 pt-3 pb-2">
        <div className="flex h-9 items-center justify-between px-1">
          <Link
            aria-label="lab home"
            className="flex items-center gap-2 rounded-lg font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setOpenMobile(false)}
            to="/"
          >
            <FlaskConical className="size-5" strokeWidth={1.7} />
            <span>lab</span>
          </Link>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarTrigger className="size-9 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="right">Close sidebar</TooltipContent>
          </Tooltip>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-10 gap-3 rounded-xl"
              isActive={location.pathname === "/"}
            >
              <Link onClick={() => setOpenMobile(false)} to="/">
                <SquarePen />
                <span>New chat</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {conversations.items !== undefined &&
          conversations.items.length > 0 && (
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
              />
              <Input
                aria-label="Filter loaded chats"
                className="h-9 rounded-xl border-transparent bg-background/60 pr-9 pl-9 text-sm shadow-none"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter loaded chats"
                type="search"
                value={search}
              />
              {search !== "" && (
                <Button
                  aria-label="Clear chat filter"
                  className="absolute top-0.5 right-0.5"
                  onClick={() => setSearch("")}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <X />
                </Button>
              )}
            </div>
          )}
      </SidebarHeader>
      <SidebarContent className="gap-0 px-1 pb-2">
        <SidebarGroup>
          <div className="flex items-center justify-between pr-1">
            <SidebarGroupLabel>Your chats</SidebarGroupLabel>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Refresh chats"
                  disabled={!connected || conversations.isFetching}
                  onClick={() => void conversations.refresh()}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <RefreshCw
                    className={cn(
                      "size-3.5",
                      conversations.isFetching && "motion-safe:animate-spin",
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh chats</TooltipContent>
            </Tooltip>
          </div>
          <SidebarGroupContent>
            {items === undefined ? (
              conversations.isError || !connected ? (
                <p
                  className="px-2 py-3 text-xs leading-5 text-muted-foreground"
                  role="status"
                >
                  {conversations.isError
                    ? "Unable to load chats. Try refreshing."
                    : "Connecting to your chats…"}
                </p>
              ) : (
                <div
                  aria-label="Loading chats"
                  className="space-y-3 px-2 py-3"
                  role="status"
                >
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              )
            ) : items.length === 0 ? (
              <p className="px-2 py-3 text-xs leading-5 text-muted-foreground">
                {search.trim() === ""
                  ? "Your chats will appear here."
                  : "No loaded chats match."}
              </p>
            ) : (
              <nav aria-label="Chats">
                <SidebarMenu className="gap-0.5">
                  {items.map((conversation) => {
                    const unconfirmed = pending.requests.some(
                      (request) =>
                        request.kind === "submit" &&
                        request.conversationId === conversation.id,
                    );

                    return (
                      <SidebarMenuItem key={conversation.id}>
                        <SidebarMenuButton
                          asChild
                          className="h-9 rounded-lg px-3 font-normal"
                          isActive={
                            location.pathname ===
                            `/conversations/${conversation.id}`
                          }
                        >
                          <NavLink
                            end
                            onClick={() => setOpenMobile(false)}
                            title={conversation.title}
                            to={`/conversations/${conversation.id}`}
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {conversation.title}
                            </span>
                            {unconfirmed && (
                              <span className="size-1.5 shrink-0 rounded-full bg-amber-500">
                                <span className="sr-only">
                                  Message unconfirmed
                                </span>
                              </span>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </nav>
            )}
            {conversations.error && (
              <p className="px-2 py-2 text-xs text-destructive" role="alert">
                {conversations.error.message}
              </p>
            )}
            {!connected && conversations.items !== undefined && (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                Showing your last saved chat list.
              </p>
            )}
            {conversations.hasNextPage && (
              <Button
                className="mt-2 w-full text-muted-foreground"
                disabled={!connected || conversations.isFetching}
                onClick={() => void conversations.fetchNextPage()}
                size="sm"
                type="button"
                variant="ghost"
              >
                {conversations.isFetchingNextPage
                  ? "Loading…"
                  : "Load more chats"}
              </Button>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator className="mx-3" />
      <SidebarFooter className="p-3">
        {(session.error || pending.error) && (
          <p className="px-2 text-xs text-destructive" role="alert">
            {session.error ?? pending.error?.message}
          </p>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="h-12 w-full justify-start gap-3 rounded-xl px-2 text-left font-normal"
              type="button"
              variant="ghost"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent">
                <CircleUserRound className="size-4" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">
                  Your workspace
                </span>
                <ConnectionStatus />
              </span>
              <ChevronsUpDown className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56"
            side={isMobile ? "top" : "right"}
          >
            <DropdownMenuLabel>lab workspace</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <SunMoon />
                Appearance
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  onValueChange={(value) => {
                    if (
                      value === "light" ||
                      value === "dark" ||
                      value === "system"
                    ) {
                      setTheme(value);
                    }
                  }}
                  value={theme}
                >
                  <DropdownMenuRadioItem value="light">
                    <Sun />
                    Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <Moon />
                    Dark
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <Monitor />
                    System
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {connection.status === "incompatible" && (
              <DropdownMenuItem onSelect={() => window.location.reload()}>
                <RefreshCw />
                Reload to reconnect
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={session.pending}
              onSelect={() => void session.logout()}
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function ConnectionStatus() {
  const connection = useConnection();
  const labels = {
    disconnected: "Disconnected",
    connecting: "Connecting…",
    connected: "Connected",
    reconnecting: "Reconnecting…",
    unauthorized: "Sign in to reconnect",
    incompatible: "Reload to reconnect",
  };

  return (
    <span
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
      role="status"
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full bg-muted-foreground/50",
          connection.status === "connected" && "bg-emerald-500",
        )}
      />
      {labels[connection.status]}
    </span>
  );
}
