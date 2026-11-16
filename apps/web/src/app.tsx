import { Conversation } from '@/components/conversation';
import { Sidebar } from '@/components/sidebar';
import { SignIn } from '@/components/sign-in';
import { authClient } from '@/lib/auth';
import { selectConversation, useSelectedConversation } from '@/lib/route';

export function App() {
  const session = authClient.useSession();
  const selected = useSelectedConversation();

  if (session.isPending) {
    return null;
  }

  if (!session.data) {
    return <SignIn />;
  }

  return (
    <div className='flex h-svh'>
      <Sidebar
        selected={selected}
        onSelect={selectConversation}
        user={session.data.user}
      />
      <main className='flex min-w-0 flex-1 flex-col'>
        {selected === undefined ? (
          <div className='flex flex-1 items-center justify-center p-6'>
            <p className='text-muted-foreground'>
              Start a new chat to talk to Lab.
            </p>
          </div>
        ) : (
          <Conversation key={selected} id={selected} />
        )}
      </main>
    </div>
  );
}
