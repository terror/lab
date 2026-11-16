import { Conversation } from '@/components/conversation';
import { NewChat } from '@/components/new-chat';
import { Settings } from '@/components/settings';
import { Sidebar } from '@/components/sidebar';
import { SignIn } from '@/components/sign-in';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { authClient } from '@/lib/auth';
import { openNewChat, selectConversation, useRoute } from '@/lib/route';
import { usePersistentState } from '@/lib/storage';
import { z } from 'zod';

const layoutSchema = z.record(z.string(), z.number()).optional();

export function App() {
  const session = authClient.useSession();
  const route = useRoute();

  const [layout, setLayout] = usePersistentState(
    'layout',
    layoutSchema,
    undefined
  );

  if (session.isPending) {
    return null;
  }

  if (!session.data) {
    return <SignIn />;
  }

  if (route.kind === 'settings') {
    return <Settings />;
  }

  const selected = route.kind === 'conversation' ? route.id : undefined;

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
            user={session.data.user}
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel id='main' minSize='40%'>
          <main className='flex h-full min-w-0 flex-col'>
            {selected === undefined ? (
              <NewChat user={session.data.user} />
            ) : (
              <Conversation key={selected} id={selected} />
            )}
          </main>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
