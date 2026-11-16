import { Conversation } from '@/components/conversation';
import { NewChat } from '@/components/new-chat';
import { Settings } from '@/components/settings';
import { SignIn } from '@/components/sign-in';
import { Workspace } from '@/components/workspace';
import { authClient, useUser } from '@/lib/auth';
import { useThemeClass } from '@/lib/theme';
import {
  Navigate,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
} from '@tanstack/react-router';

function Root() {
  const session = authClient.useSession();

  useThemeClass();

  if (session.isPending) {
    return null;
  }

  if (!session.data) {
    return <SignIn />;
  }

  return <Outlet />;
}

function NewChatPage() {
  return <NewChat user={useUser()} />;
}

function ConversationPage() {
  const { id } = conversationRoute.useParams();

  return <Conversation key={id} id={id} />;
}

const rootRoute = createRootRoute({
  component: Root,
  notFoundComponent: () => <Navigate replace to='/' />,
});

const chatRoute = createRoute({
  component: Workspace,
  getParentRoute: () => rootRoute,
  id: 'chat',
});

const newChatRoute = createRoute({
  component: NewChatPage,
  getParentRoute: () => chatRoute,
  path: '/',
});

const conversationRoute = createRoute({
  component: ConversationPage,
  getParentRoute: () => chatRoute,
  params: {
    parse: ({ id }) => {
      const value = Number(id);

      if (!Number.isInteger(value) || value <= 0) {
        throw notFound();
      }

      return { id: value };
    },
    stringify: ({ id }) => ({ id: String(id) }),
  },
  path: '/c/$id',
});

const settingsRoute = createRoute({
  component: Settings,
  getParentRoute: () => rootRoute,
  path: '/settings',
});

const routeTree = rootRoute.addChildren([
  chatRoute.addChildren([newChatRoute, conversationRoute]),
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
