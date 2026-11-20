import { useSearch } from '@/components/search';
import { type NavPath, Sidebar } from '@/components/sidebar';
import { Button } from '@/components/ui/button';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { appSeed, useArtifact } from '@/lib/artifacts';
import { type User, useUser } from '@/lib/auth';
import { conversationTitle, useConversationSummary } from '@/lib/conversations';
import { usePath } from '@/lib/location';
import { useMediaQuery } from '@/lib/media';
import { useProjects } from '@/lib/projects';
import { useTimezoneReport } from '@/lib/schedules';
import { usePersistentState } from '@/lib/storage';
import { useDocumentTitle } from '@/lib/title';
import { cn } from '@/lib/utils';
import { Outlet, useNavigate, useParams } from '@tanstack/react-router';
import { PanelLeft, Search, SquarePen } from 'lucide-react';
import { useState } from 'react';
import { usePanelRef } from 'react-resizable-panels';
import { z } from 'zod';

const layoutSchema = z.record(z.string(), z.number()).optional();

const SIDEBAR_ANIMATION_MS = 300;

function Content({ className }: { className?: string }) {
  return (
    <main
      className={cn('flex h-full min-h-0 min-w-0 flex-1 flex-col', className)}
    >
      <Outlet />
    </main>
  );
}

function useNavigation() {
  const navigate = useNavigate();

  return {
    navigateTo: (to: NavPath) => {
      void navigate({ to });
    },
    openProject: (id: number) => {
      void navigate({
        params: { projectId: String(id) },
        to: '/projects/$projectId',
      });
    },
  };
}

function DesktopWorkspace({
  selected,
  user,
}: {
  selected: number | undefined;
  user: User;
}) {
  const { navigateTo, openProject } = useNavigation();
  const panel = usePanelRef();
  const [collapsed, setCollapsed] = useState(false);
  const [animating, setAnimating] = useState(false);

  const toggle = () => {
    setAnimating(true);

    if (panel.current?.isCollapsed()) {
      panel.current.expand();
    } else {
      panel.current?.collapse();
    }

    window.setTimeout(() => setAnimating(false), SIDEBAR_ANIMATION_MS);
  };

  const [layout, setLayout] = usePersistentState(
    'layout',
    layoutSchema,
    undefined
  );

  return (
    <div className='h-svh bg-sidebar'>
      <ResizablePanelGroup
        className={cn(
          animating &&
            '[&>[data-panel]]:transition-all [&>[data-panel]]:duration-300 [&>[data-panel]]:ease-out motion-reduce:[&>[data-panel]]:transition-none'
        )}
        defaultLayout={layout}
        onLayoutChanged={setLayout}
        orientation='horizontal'
      >
        <ResizablePanel
          className='overflow-hidden!'
          collapsedSize={56}
          collapsible
          defaultSize={300}
          groupResizeBehavior='preserve-pixel-size'
          id='sidebar'
          maxSize={480}
          minSize={200}
          onResize={() => setCollapsed(panel.current?.isCollapsed() ?? false)}
          panelRef={panel}
        >
          <Sidebar
            collapsed={collapsed}
            selected={selected}
            onNavigate={navigateTo}
            onProject={openProject}
            onToggle={toggle}
            user={user}
          />
        </ResizablePanel>
        <ResizableHandle className='bg-transparent' />
        <ResizablePanel className='py-2 pr-2' id='main' minSize='40%'>
          <Content className='overflow-hidden rounded-xl border bg-background shadow-xs' />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function MobileWorkspace({
  selected,
  user,
}: {
  selected: number | undefined;
  user: User;
}) {
  const { navigateTo, openProject } = useNavigation();
  const { openSearch } = useSearch();

  const [open, setOpen] = useState(false);

  const title = usePageTitle(selected);

  return (
    <div className='flex h-svh flex-col'>
      <header className='flex items-center gap-1 px-2 py-2'>
        <Button
          aria-label='Open menu'
          onClick={() => setOpen(true)}
          size='icon'
          variant='ghost'
        >
          <PanelLeft aria-hidden='true' />
        </Button>
        <span className='min-w-0 flex-1 truncate text-center text-sm font-medium'>
          {title}
        </span>
        <Button
          aria-label='Search'
          onClick={openSearch}
          size='icon'
          variant='ghost'
        >
          <Search aria-hidden='true' />
        </Button>
        <Button
          aria-label='New chat'
          onClick={() => navigateTo('/')}
          size='icon'
          variant='ghost'
        >
          <SquarePen aria-hidden='true' />
        </Button>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className='w-72 p-0' showCloseButton={false} side='left'>
          <SheetTitle className='sr-only'>Menu</SheetTitle>
          <SheetDescription className='sr-only'>
            Your chats and account
          </SheetDescription>
          <Sidebar
            selected={selected}
            onNavigate={(to) => {
              setOpen(false);
              navigateTo(to);
            }}
            onProject={(id) => {
              setOpen(false);
              openProject(id);
            }}
            onSelect={() => setOpen(false)}
            user={user}
          />
        </SheetContent>
      </Sheet>
      <Content />
    </div>
  );
}

const pageTitles: Record<string, string> = {
  '/library': 'Library',
  '/scheduled': 'Scheduled',
};

function usePageTitle(selected: number | undefined) {
  const path = usePath();
  const conversation = useConversationSummary(selected);
  const projects = useProjects();
  const { artifactId, conversationId } = useParams({ strict: false });
  const app = useArtifact(conversationId, artifactId);

  const projectId = Number(/^\/projects\/(\d+)$/.exec(path)?.[1]);

  const project = projects.data?.projects.find(({ id }) => id === projectId);

  const chat = conversation.data && conversationTitle(conversation.data.title);

  return pageTitles[path] ?? project?.name ?? app.data?.title ?? chat ?? 'Lab';
}

function useTab(selected: number | undefined) {
  const title = usePageTitle(selected);
  const { artifactId, conversationId } = useParams({ strict: false });
  const app = useArtifact(conversationId, artifactId);

  if (!app.data || conversationId === undefined || artifactId === undefined) {
    return { title };
  }

  return {
    seed: appSeed(conversationId, artifactId),
    title: `${title} · Lab`,
  };
}

function WorkspaceLayout({
  desktop,
  selected,
  user,
}: {
  desktop: boolean;
  selected: number | undefined;
  user: User;
}) {
  if (desktop) {
    return <DesktopWorkspace selected={selected} user={user} />;
  }

  return <MobileWorkspace selected={selected} user={user} />;
}

export function Workspace() {
  const user = useUser();
  const selected = useParams({ strict: false }).id;
  const desktop = useMediaQuery('(min-width: 768px)');

  useTimezoneReport();

  const tab = useTab(selected);

  useDocumentTitle(tab.title, tab.seed);

  return <WorkspaceLayout desktop={desktop} selected={selected} user={user} />;
}
