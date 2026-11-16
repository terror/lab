import { Settings } from '@/components/settings';
import { SignIn } from '@/components/sign-in';
import { Workspace } from '@/components/workspace';
import { authClient } from '@/lib/auth';
import { useRoute } from '@/lib/route';

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

  return (
    <Workspace
      selected={route.kind === 'conversation' ? route.id : undefined}
      user={session.data.user}
    />
  );
}
