import { LabClient } from "@lab/client";
import {
  LabProvider,
  useConnection,
  useConversations,
  usePendingRequests,
} from "@lab/client/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type Dispatch, type SetStateAction, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router";
import useSessionStorageState from "use-session-storage-state";
import { Conversation } from "@/components/conversation";
import { CreateConversation } from "@/components/create-conversation";
import { Button } from "@/components/ui/button";
import type { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export default function Workspace({
  session,
}: {
  session: ReturnType<typeof useSession>;
}) {
  const [queries] = useState(() => new QueryClient());
  const [client] = useState(
    () => new LabClient({ onUnauthorized: () => void session.refresh() }),
  );

  return (
    <QueryClientProvider client={queries}>
      <LabProvider client={client}>
        <WorkspaceContent session={session} />
      </LabProvider>
    </QueryClientProvider>
  );
}

function WorkspaceContent({
  session,
}: {
  session: ReturnType<typeof useSession>;
}) {
  const navigate = useNavigate();
  const connection = useConnection();
  const conversations = useConversations();
  const pending = usePendingRequests();
  const connected = connection.status === "connected";
  const [drafts, setDrafts, { isPersistent }] = useSessionStorageState<
    Record<number, string>
  >("lab.drafts.v1", { defaultValue: {} });

  return (
    <div className="flex h-svh flex-col bg-background text-foreground md:flex-row">
      <aside className="flex max-h-[45svh] shrink-0 flex-col gap-4 overflow-y-auto border-b bg-muted/30 p-4 md:max-h-none md:w-72 md:border-r md:border-b-0 md:p-6">
        <div>
          <Link
            className="rounded-sm text-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-ring"
            to="/"
          >
            Lab
          </Link>
          <p className="text-xs text-muted-foreground">
            Personal agent workspace
          </p>
        </div>
        <CreateConversation
          onCreated={(conversation) => {
            void navigate(`/conversations/${conversation.id}`);
            void conversations.refresh();
          }}
        />
        <nav
          aria-label="Conversations"
          className="min-h-20 space-y-2 md:min-h-0 md:flex-1 md:overflow-y-auto"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Conversations</h2>
            <Button
              disabled={!connected || conversations.isFetching}
              onClick={() => void conversations.refresh()}
              size="xs"
              type="button"
              variant="ghost"
            >
              Refresh
            </Button>
          </div>
          {conversations.items === undefined ? (
            <p className="text-sm text-muted-foreground" role="status">
              {conversations.isError
                ? "Unable to load conversations."
                : connected
                  ? "Loading conversations…"
                  : "Waiting for connection…"}
            </p>
          ) : conversations.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No conversations yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {conversations.items.map((conversation) => (
                <li key={conversation.id}>
                  <NavLink
                    className={({ isActive }) =>
                      cn(
                        "block rounded-md px-3 py-2 text-sm break-words transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
                        isActive &&
                          "bg-accent font-medium text-accent-foreground",
                      )
                    }
                    end
                    to={`/conversations/${conversation.id}`}
                  >
                    {conversation.title}
                    {pending.requests.some(
                      (request) =>
                        request.kind === "submit" &&
                        request.conversationId === conversation.id,
                    ) && (
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        Message unconfirmed
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
          {conversations.error && (
            <p className="text-xs text-destructive" role="alert">
              {conversations.error.message}
            </p>
          )}
          {conversations.stale && conversations.items !== undefined && (
            <p className="text-xs text-muted-foreground">
              The list may be out of date.
            </p>
          )}
          {conversations.hasNextPage && (
            <Button
              className="w-full"
              disabled={!connected || conversations.isFetching}
              onClick={() => void conversations.fetchNextPage()}
              size="sm"
              type="button"
              variant="ghost"
            >
              {conversations.isFetching ? "Loading…" : "Load more"}
            </Button>
          )}
        </nav>
        <div className="mt-auto space-y-3 border-t pt-4">
          <ConnectionStatus />
          {(session.error || pending.error) && (
            <p className="text-xs text-destructive" role="alert">
              {session.error ?? pending.error?.message}
            </p>
          )}
          <Button
            disabled={session.pending}
            onClick={() => void session.logout()}
            size="sm"
            type="button"
            variant="ghost"
          >
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Routes>
          <Route path="/" element={<EmptyState />} />
          <Route
            path="/conversations/:id"
            element={
              <ConversationRoute
                drafts={drafts}
                setDrafts={setDrafts}
                isPersistent={isPersistent}
              />
            }
          />
          <Route path="*" element={<EmptyState notFound />} />
        </Routes>
      </main>
    </div>
  );
}

function ConversationRoute({
  drafts,
  setDrafts,
  isPersistent,
}: {
  drafts: Record<number, string>;
  setDrafts: Dispatch<SetStateAction<Record<number, string>>>;
  isPersistent: boolean;
}) {
  const params = useParams();
  const id = Number(params.id);
  const text = drafts?.[id];

  return /^[1-9][0-9]*$/.test(params.id ?? "") && Number.isSafeInteger(id) ? (
    <Conversation
      id={id}
      key={id}
      draft={{
        text: typeof text === "string" ? text : "",
        isPersistent,
        set: (text) => setDrafts((current) => ({ ...current, [id]: text })),
        clear: (text) =>
          setDrafts((current) =>
            current?.[id] === text ? { ...current, [id]: "" } : current,
          ),
      }}
    />
  ) : (
    <EmptyState notFound />
  );
}

function EmptyState({ notFound = false }: { notFound?: boolean }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-sm space-y-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {notFound ? "Page not found" : "A place for your work"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {notFound
            ? "Choose a conversation from the list to continue."
            : "Create a conversation or open one from the list to continue."}
        </p>
        {notFound && (
          <Button asChild variant="outline">
            <Link to="/">Back to workspace</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function ConnectionStatus() {
  const connection = useConnection();
  const labels = {
    disconnected: "Disconnected",
    connecting: "Connecting…",
    connected: "Connected",
    reconnecting: "Reconnecting…",
    unauthorized: "Sign in to reconnect.",
    incompatible: "Reload this page to reconnect.",
  };

  return (
    <div className="space-y-2">
      <p
        className="flex items-center gap-2 text-xs text-muted-foreground"
        role="status"
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-2 rounded-full bg-muted-foreground/40",
            connection.status === "connected" && "bg-emerald-600",
          )}
        />
        {labels[connection.status]}
      </p>
      {connection.status === "incompatible" && (
        <Button
          onClick={() => window.location.reload()}
          size="sm"
          type="button"
          variant="outline"
        >
          Reload
        </Button>
      )}
    </div>
  );
}
