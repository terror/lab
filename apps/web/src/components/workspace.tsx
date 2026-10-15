import { LabClient } from "@lab/client";
import { LabProvider, useConversations } from "@lab/client/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AlertCircle, X } from "lucide-react";
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { usePanelRef } from "react-resizable-panels";
import {
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";
import useSessionStorageState from "use-session-storage-state";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatHeader } from "@/components/chat-header";
import { Conversation } from "@/components/conversation";
import { CreateConversation } from "@/components/create-conversation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import type { useSession } from "@/lib/session";

export default function Workspace({
  session,
}: {
  session: ReturnType<typeof useSession>;
}) {
  const [queries] = useState(() => new QueryClient());
  const [client] = useState(
    () => new LabClient({ onUnauthorized: () => void session.refresh() }),
  );
  const [open, setOpen] = useSessionStorageState("lab.sidebar-open.v1", {
    defaultValue: true,
  });

  return (
    <QueryClientProvider client={queries}>
      <LabProvider client={client}>
        <SidebarProvider
          className="h-dvh min-h-0 overflow-hidden bg-background text-foreground"
          onOpenChange={setOpen}
          open={typeof open === "boolean" ? open : true}
        >
          <WorkspaceContent session={session} />
        </SidebarProvider>
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
  const location = useLocation();
  const currentLocation = useRef(location);
  const conversations = useConversations();
  const [drafts, setDrafts, { isPersistent }] = useSessionStorageState<
    Record<number, string>
  >("lab.drafts.v1", { defaultValue: {} });
  const [errors, setErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    currentLocation.current = location;
  }, [location]);

  return (
    <>
      <a
        className="sr-only fixed top-3 left-3 z-50 rounded-lg bg-background px-4 py-2 text-sm shadow-md focus:not-sr-only"
        href="#main-content"
      >
        Skip to conversation
      </a>
      <WorkspaceLayout sidebar={<AppSidebar session={session} />}>
        <SidebarInset
          className="h-full min-h-0 min-w-0 overflow-hidden outline-none"
          id="main-content"
          tabIndex={-1}
        >
          <Routes>
            <Route
              path="/"
              element={
                <CreateConversation
                  onPrepared={(conversation, content) => {
                    setDrafts((current) =>
                      typeof current?.[conversation.id] === "string"
                        ? current
                        : { ...current, [conversation.id]: content },
                    );
                  }}
                  onSubmitted={(conversation, content) => {
                    setDrafts((current) =>
                      current?.[conversation.id] === content
                        ? { ...current, [conversation.id]: "" }
                        : current,
                    );
                  }}
                  onCreated={(conversation, error) => {
                    if (error !== undefined) {
                      setErrors((current) => ({
                        ...current,
                        [conversation.id]: error,
                      }));
                    }

                    void conversations.refresh();

                    if (
                      currentLocation.current.pathname === "/" &&
                      currentLocation.current.key === location.key
                    ) {
                      void navigate(`/conversations/${conversation.id}`);
                    }
                  }}
                />
              }
            />
            <Route
              path="/conversations/:id"
              element={
                <ConversationRoute
                  drafts={drafts}
                  errors={errors}
                  isPersistent={isPersistent}
                  setDrafts={setDrafts}
                  setErrors={setErrors}
                />
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SidebarInset>
      </WorkspaceLayout>
    </>
  );
}

function WorkspaceLayout({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const { isMobile, open, setOpen } = useSidebar();
  const panel = usePanelRef();
  const previousMobile = useRef(isMobile);
  const [savedWidth, setWidth] = useSessionStorageState(
    "lab.sidebar-width.v1",
    {
      defaultValue: 260,
    },
  );
  const width =
    typeof savedWidth === "number" && Number.isFinite(savedWidth)
      ? Math.min(400, Math.max(200, savedWidth))
      : 260;
  const [initialSize] = useState(!isMobile && open ? width : 0);

  useLayoutEffect(() => {
    const restore = previousMobile.current && !isMobile;
    previousMobile.current = isMobile;

    if (isMobile || !open) {
      panel.current?.collapse();
    } else if (restore || panel.current?.isCollapsed()) {
      panel.current?.resize(width);
    }
  }, [isMobile, open, panel, width]);

  return (
    <ResizablePanelGroup
      className="min-h-0 min-w-0"
      disabled={isMobile}
      onLayoutChanged={(_, { isUserInteraction }) => {
        const size = panel.current?.getSize().inPixels;

        if (!isMobile && isUserInteraction && size !== undefined) {
          if (size > 0 !== open) {
            setOpen(size > 0);
          }

          if (size >= 200) {
            setWidth(Math.round(size));
          }
        }
      }}
      orientation="horizontal"
    >
      <ResizablePanel
        collapsedSize={0}
        collapsible
        defaultSize={initialSize}
        groupResizeBehavior="preserve-pixel-size"
        id="navigation"
        maxSize={isMobile ? 0 : 400}
        minSize={isMobile ? 0 : 200}
        panelRef={panel}
        style={{ overflow: "hidden" }}
      >
        <div className="h-full min-w-0" inert={!isMobile && !open}>
          {sidebar}
        </div>
      </ResizablePanel>
      <ResizableHandle
        aria-label="Resize conversation sidebar"
        className={
          isMobile
            ? "hidden"
            : "bg-transparent transition-colors hover:bg-border data-[separator=active]:bg-ring"
        }
        disabled={isMobile}
      />
      <ResizablePanel
        className="h-full min-h-0 min-w-0"
        id="conversation"
        minSize={isMobile ? 0 : 320}
        style={{ overflow: "hidden" }}
      >
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function ConversationRoute({
  drafts,
  errors,
  setDrafts,
  setErrors,
  isPersistent,
}: {
  drafts: Record<number, string>;
  errors: Record<number, string>;
  setDrafts: Dispatch<SetStateAction<Record<number, string>>>;
  setErrors: Dispatch<SetStateAction<Record<number, string>>>;
  isPersistent: boolean;
}) {
  const params = useParams();
  const id = Number(params.id);
  const text = drafts?.[id];

  if (!/^[1-9][0-9]*$/.test(params.id ?? "") || !Number.isSafeInteger(id)) {
    return <NotFound />;
  }

  return (
    <>
      {errors[id] && (
        <div className="shrink-0 px-4 pt-3 sm:px-6">
          <Alert className="relative pr-12" variant="destructive">
            <AlertCircle />
            <AlertTitle>Your first message needs attention</AlertTitle>
            <AlertDescription>{errors[id]}</AlertDescription>
            <Button
              aria-label="Dismiss message error"
              className="absolute top-2 right-2"
              onClick={() => setErrors((current) => ({ ...current, [id]: "" }))}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X />
            </Button>
          </Alert>
        </div>
      )}
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
    </>
  );
}

function NotFound() {
  return (
    <>
      <ChatHeader title="lab" />
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-medium tracking-tight">
            Chat not found
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Open a chat from the sidebar or start a new one.
          </p>
          <Button asChild variant="outline">
            <Link to="/">Start a new chat</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
