import { ChatHeader } from '@/components/chat-header';
import { ChatSession } from '@/components/chat-session';
import { ErrorNotice } from '@/components/error-notice';
import { LabMark } from '@/components/lab-mark';
import { NewChat } from '@/components/new-chat';
import { Sidebar } from '@/components/sidebar';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useChatNavigation } from '@/hooks/use-chat-navigation';
import { useSidebar } from '@/hooks/use-sidebar';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { Dialog } from 'radix-ui';

export function ChatWorkspace() {
  const workspaces = useWorkspaces();
  const navigation = useChatNavigation();
  const sidebar = useSidebar();

  const workspace =
    workspaces.data?.find(
      (workspace) => workspace.id === navigation.workspaceId
    ) ?? workspaces.data?.[0];

  if (!workspace) {
    return (
      <div className='flex min-h-svh flex-col items-center justify-center gap-6 px-6'>
        <LabMark className='size-10' />
        {workspaces.error ? (
          <ErrorNotice
            error={workspaces.error}
            onRetry={() => void workspaces.refetch()}
          />
        ) : (
          <p role='status' className='text-sm text-muted-foreground'>
            {workspaces.isPending
              ? 'Opening your workspace…'
              : 'No workspaces are available for this account.'}
          </p>
        )}
      </div>
    );
  }

  function navigate(workspaceId: string, sessionId: string | null = null) {
    navigation.navigate(workspaceId, sessionId);
    sidebar.closeMobile();
  }

  const newChat = () => navigate(workspace.id);

  const sidebarProps = {
    workspaceId: workspace.id,
    sessionId: navigation.sessionId,
    onSession: (id: string) => navigate(workspace.id, id),
    onNewChat: newChat,
  };

  const header = {
    onMobileMenu: sidebar.openMobile,
    onOpenSidebar: sidebar.expand,
    sidebarCollapsed: sidebar.collapsed,
  };

  return (
    <div className='flex h-svh overflow-hidden bg-background'>
      <Dialog.Root
        open={sidebar.mobileOpen}
        onOpenChange={sidebar.setMobileOpen}
      >
        <Dialog.Portal>
          <Dialog.Overlay className='fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] md:hidden' />
          <Dialog.Content
            className='fixed inset-y-0 left-0 z-50 w-66 max-w-[calc(100%-2rem)] outline-none md:hidden'
            aria-describedby={undefined}
          >
            <Dialog.Title className='sr-only'>Chat history</Dialog.Title>
            <Sidebar {...sidebarProps} onCollapse={sidebar.closeMobile} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <ResizablePanelGroup
        orientation='horizontal'
        defaultLayout={sidebar.defaultLayout}
        onLayoutChanged={sidebar.onLayoutChanged}
      >
        {sidebar.desktop && (
          <>
            <ResizablePanel
              id='sidebar'
              panelRef={sidebar.panelRef}
              defaultSize={264}
              minSize={224}
              maxSize={400}
              collapsible
              collapsedSize={0}
              groupResizeBehavior='preserve-pixel-size'
              onResize={sidebar.onResize}
            >
              <aside className='h-full' inert={sidebar.collapsed}>
                <Sidebar {...sidebarProps} onCollapse={sidebar.collapse} />
              </aside>
            </ResizablePanel>
            <ResizableHandle aria-label='Resize sidebar' />
          </>
        )}
        <ResizablePanel id='conversation' minSize={sidebar.desktop ? 360 : 0}>
          <div className='flex h-full min-w-0 flex-col'>
            {navigation.sessionId ? (
              <ChatSession
                key={navigation.sessionId}
                sessionId={navigation.sessionId}
                header={header}
              />
            ) : (
              <>
                <ChatHeader {...header} title='New chat' />
                <NewChat
                  key={workspace.id}
                  workspaceId={workspace.id}
                  onCreated={(sessionId) => navigate(workspace.id, sessionId)}
                />
              </>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
