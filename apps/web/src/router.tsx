import { BudgetAlert } from '@/components/budget';
import { Conversation } from '@/components/conversation';
import { ErrorPage } from '@/components/error-page';
import { loadMarkdown } from '@/components/markdown';
import { NewChat } from '@/components/new-chat';
import { SignIn } from '@/components/sign-in';
import { Updates } from '@/components/updates';
import { Workspace } from '@/components/workspace';
import { authClient, useUser } from '@/lib/auth';
import { prefetchSidebar } from '@/lib/conversations';
import { modelsQueryOptions } from '@/lib/models';
import { preferencesQueryOptions } from '@/lib/preferences';
import { projectsQueryOptions } from '@/lib/projects';
import { queryClient } from '@/lib/query-client';
import { settingsSearchSchema } from '@/lib/settings';
import { useThemeClass } from '@/lib/theme';
import { defaultPreferences } from '@lab/server/schemas';
import {
  Navigate,
  Outlet,
  createRootRoute,
  createRoute,
  lazyRouteComponent,
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

  return (
    <>
      <Outlet />
      <Updates />
      <BudgetAlert />
    </>
  );
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
  loader: async () => {
    const [, preferences] = await Promise.allSettled([
      queryClient.query({ ...modelsQueryOptions, staleTime: 'static' }),
      queryClient.query({ ...preferencesQueryOptions, staleTime: 'static' }),
      queryClient.query(projectsQueryOptions),
    ]);

    await prefetchSidebar(
      queryClient,
      preferences.status === 'fulfilled'
        ? preferences.value.chatSort
        : defaultPreferences.chatSort
    );
  },
});

const newChatRoute = createRoute({
  component: NewChatPage,
  getParentRoute: () => chatRoute,
  path: '/',
});

const libraryRoute = createRoute({
  component: lazyRouteComponent(
    () => import('@/components/library'),
    'Library'
  ),
  getParentRoute: () => chatRoute,
  path: '/library',
});

const scheduledRoute = createRoute({
  component: lazyRouteComponent(
    () => import('@/components/scheduled'),
    'Scheduled'
  ),
  getParentRoute: () => chatRoute,
  path: '/scheduled',
});

const projectRoute = createRoute({
  component: lazyRouteComponent(
    () => import('@/components/project'),
    'Project'
  ),
  getParentRoute: () => chatRoute,
  path: '/projects/$projectId',
});

const conversationRoute = createRoute({
  component: ConversationPage,
  getParentRoute: () => chatRoute,
  loader: () => loadMarkdown().catch(() => undefined),
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
  component: lazyRouteComponent(
    () => import('@/components/settings'),
    'Settings'
  ),
  getParentRoute: () => rootRoute,
  path: '/settings',
  validateSearch: (search) => settingsSearchSchema.parse(search),
});

const routeTree = rootRoute.addChildren([
  chatRoute.addChildren([
    newChatRoute,
    libraryRoute,
    scheduledRoute,
    projectRoute,
    conversationRoute,
  ]),
  settingsRoute,
]);

export const router = createRouter({
  defaultErrorComponent: ErrorPage,
  routeTree,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
