import { Conversation } from '@/components/conversation';
import { NewChat } from '@/components/new-chat';
import { Settings } from '@/components/settings';
import { Sidebar } from '@/components/sidebar';
import { SignIn } from '@/components/sign-in';
import { authClient } from '@/lib/auth';
import { openNewChat, selectConversation, useRoute } from '@/lib/route';

export function App() {
  const session = authClient.useSession();
  const route = useRoute();

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
    <div className='flex h-svh'>
      <Sidebar
        selected={selected}
        onNewChat={openNewChat}
        onSelect={selectConversation}
        user={session.data.user}
      />
      <main className='flex min-w-0 flex-1 flex-col'>
        {selected === undefined ? (
          <NewChat user={session.data.user} />
        ) : (
          <Conversation key={selected} id={selected} />
        )}
      </main>
    </div>
  );
}
