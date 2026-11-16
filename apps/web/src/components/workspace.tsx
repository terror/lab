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
import { useQuery } from '@tanstack/react-query';
import { Outlet, useNavigate, useParams } from '@tanstack/react-router';
import { PanelLeft, SquarePen } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';

type User = {
  email: string;
  id: string;
  image?: string | null;
  name: string;
};

const layoutSchema = z.record(z.string(), z.number()).optional();

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

  const [layout, setLayout] = usePersistentState(
    'layout',
    layoutSchema,
    undefined
  );

  return (
    <div className='h-svh'>
      <ResizablePanelGroup
        defaultLayout={layout}
        onLayoutChanged={setLayout}
        orientation='horizontal'
      >
        <ResizablePanel
          defaultSize={256}
          groupResizeBehavior='preserve-pixel-size'
          id='sidebar'
          maxSize={480}
          minSize={200}
        >
          <Sidebar
            selected={selected}
            onNewChat={openNewChat}
            onSelect={selectConversation}
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
