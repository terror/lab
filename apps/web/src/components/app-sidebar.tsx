import {
  useConnection,
  useConversations,
  useLabClient,
  usePendingRequests,
} from "@lab/client/react";
import type { ConversationId, ConversationPage } from "@lab/contracts";
import {
  type InfiniteData,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ChevronsUpDown,
  CircleUserRound,
  LogOut,
  Monitor,
  Moon,
  MoreHorizontal,
  RefreshCw,
  Search,
  SquarePen,
  Sun,
  SunMoon,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { LabMark } from "@/components/lab-mark";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
  SidebarMenuAction,
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
  onDeleted,
  session,
}: {
  onDeleted: (id: ConversationId) => void;
  session: ReturnType<typeof useSession>;
}) {
  const location = useLocation();
  const client = useLabClient();
  const queries = useQueryClient();
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

  const deletion = useMutation({
    networkMode: "always",
    retry: false,
    mutationFn: async (id: ConversationId) => {
      const result = await client.deleteConversation(id);

      if (!result.ok && result.error.code !== "not_found") {
        throw new Error(result.error.message);
      }
    },
    onSuccess: async (_value, id) => {
      await queries.cancelQueries({ queryKey: ["lab", "conversations"] });
      queries.setQueryData<InfiniteData<ConversationPage>>(
        ["lab", "conversations"],
        (current) =>
          current === undefined
            ? current
            : {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  items: page.items.filter((item) => item.id !== id),
                })),
              },
      );
      onDeleted(id);
      void queries.invalidateQueries({ queryKey: ["lab", "conversations"] });
    },
  });

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
      <SidebarHeader className="gap-4 border-b px-3 pt-3 pb-4">
        <div className="flex h-10 items-center justify-between px-1">
          <Link
            aria-label="lab home"
            className="flex items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setOpenMobile(false)}
            to="/"
          >
            <LabMark className="size-7" />
            <span className="font-serif text-3xl tracking-tight">lab</span>
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
              className="h-10 gap-3 rounded-sm border border-input bg-background/50 px-3 text-xs tracking-wide data-[active=true]:border-primary/50 data-[active=true]:text-primary"
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
                className="h-9 rounded-sm bg-background/60 pr-9 pl-9 text-xs shadow-none md:text-xs"
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
      <SidebarContent className="gap-0 px-1 pt-3 pb-2">
        <SidebarGroup>
          <div className="flex items-center justify-between pr-1">
            <SidebarGroupLabel className="text-[10px] tracking-[0.16em] uppercase">
              Your chats
            </SidebarGroupLabel>
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
                    const deleting =
                      deletion.isPending &&
                      deletion.variables === conversation.id;

                    return (
                      <ContextMenu key={conversation.id}>
                        <ContextMenuTrigger asChild>
                          <SidebarMenuItem>
                            <SidebarMenuButton
                              asChild
                              className="h-10 rounded-sm border-l-2 border-transparent px-3 text-xs font-normal data-[active=true]:border-primary data-[active=true]:text-primary"
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
                                  <span className="size-1.5 shrink-0 bg-amber-500">
                                    <span className="sr-only">
                                      Message unconfirmed
                                    </span>
                                  </span>
                                )}
                              </NavLink>
                            </SidebarMenuButton>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <SidebarMenuAction
                                  aria-label={`Actions for ${conversation.title}`}
                                  className="right-2 peer-data-[size=default]/menu-button:top-2.5"
                                  showOnHover
                                >
                                  <MoreHorizontal />
                                </SidebarMenuAction>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" side="right">
                                <DropdownMenuItem
                                  disabled={!connected || deletion.isPending}
                                  onSelect={() =>
                                    deletion.mutate(conversation.id)
                                  }
                                  variant="destructive"
                                >
                                  <Trash2 />
                                  {deleting ? "Deleting…" : "Delete"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </SidebarMenuItem>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            disabled={!connected || deletion.isPending}
                            onSelect={() => deletion.mutate(conversation.id)}
                            variant="destructive"
                          >
                            <Trash2 />
                            {deleting ? "Deleting…" : "Delete"}
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
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
            {deletion.error && (
              <p className="px-2 py-2 text-xs text-destructive" role="alert">
                {deletion.error.message}
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
              className="h-12 w-full justify-start gap-3 rounded-sm px-2 text-left font-normal"
              type="button"
              variant="ghost"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border bg-sidebar-accent text-primary">
                <CircleUserRound className="size-4" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-xs font-medium">
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
      className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
      role="status"
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 bg-muted-foreground/50",
          connection.status === "connected" && "bg-primary",
        )}
      />
      {labels[connection.status]}
    </span>
  );
}
