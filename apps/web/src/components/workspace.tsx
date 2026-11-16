import { Sidebar } from '@/components/sidebar';
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
import { useUser } from '@/lib/auth';
import { conversationsQueryOptions } from '@/lib/conversations';
import { useMediaQuery } from '@/lib/media';
import { usePersistentState } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useNavigate, useParams } from '@tanstack/react-router';
import { PanelLeft, SquarePen } from 'lucide-react';
import { useState } from 'react';
import { usePanelRef } from 'react-resizable-panels';
import { z } from 'zod';

type User = {
  email: string;
  id: string;
  image?: string | null;
  name: string;
};

const layoutSchema = z.record(z.string(), z.number()).optional();

const SIDEBAR_ANIMATION_MS = 300;

function Content() {
  return (
    <main className='flex h-full min-h-0 min-w-0 flex-1 flex-col'>
      <Outlet />
    </main>
  );
}

function useNavigation() {
  const navigate = useNavigate();

  return {
    openNewChat: () => {
      void navigate({ to: '/' });
    },
    selectConversation: (id: number) => {
      void navigate({ params: { id }, to: '/c/$id' });
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
  const { openNewChat, selectConversation } = useNavigation();
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
    <div className='h-svh'>
      <ResizablePanelGroup
        className={cn(
          animating &&
            '[&>[data-panel]]:transition-[flex-grow] [&>[data-panel]]:duration-300 [&>[data-panel]]:ease-out motion-reduce:[&>[data-panel]]:transition-none'
        )}
        defaultLayout={layout}
        onLayoutChanged={setLayout}
        orientation='horizontal'
      >
        <ResizablePanel
          className='overflow-hidden!'
          collapsedSize={56}
          collapsible
          defaultSize={256}
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
            onNewChat={openNewChat}
            onSelect={selectConversation}
            onToggle={toggle}
            user={user}
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel id='main' minSize='40%'>
          <Content />
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
  const { openNewChat, selectConversation } = useNavigation();

  const [open, setOpen] = useState(false);
  const conversations = useQuery(conversationsQueryOptions);

  const title =
    selected === undefined
      ? 'New chat'
      : (conversations.data?.find(({ id }) => id === selected)?.title ??
        'New chat');

  return (
    <div className='flex h-svh flex-col'>
      <header className='flex items-center gap-1 border-b px-2 py-2'>
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
          aria-label='New chat'
          onClick={openNewChat}
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
            onNewChat={() => {
              setOpen(false);
              openNewChat();
            }}
            onSelect={(id) => {
              setOpen(false);
              selectConversation(id);
            }}
            user={user}
          />
        </SheetContent>
      </Sheet>
      <Content />
    </div>
  );
}

export function Workspace() {
  const user = useUser();
  const selected = useParams({ strict: false }).id;
  const desktop = useMediaQuery('(min-width: 768px)');

  if (desktop) {
    return <DesktopWorkspace selected={selected} user={user} />;
  }

  return <MobileWorkspace selected={selected} user={user} />;
}
