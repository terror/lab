import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test, vi } from 'vitest';

import { Sidebar } from './sidebar';

function renderSidebar({
  collapsed = false,
  onProject = () => undefined,
  path = '/projects/7',
  selected,
}: {
  collapsed?: boolean;
  onProject?: (id: number) => void;
  path?: string;
  selected?: number;
} = {}) {
  stubFetch(({ pathname, searchParams }) => {
    if (pathname === '/api/projects') {
      return Response.json({
        projects: [{ chats: 1, id: 7, instructions: '', name: 'foo' }],
      });
    }

    if (pathname === '/api/conversations/pins') {
      return Response.json({
        pins: [
          {
            artifactId: 'qux',
            conversationId: 2,
            projectId: null,
            title: 'baz',
          },
          { artifactId: 'quux', conversationId: 3, projectId: 7, title: 'qux' },
        ],
      });
    }

    if (pathname === '/api/conversations/unread') {
      return Response.json({
        chats: [],
        running: 1,
        waiting: [{ id: 2, title: 'baz' }],
      });
    }

    if (pathname === '/api/conversations/1') {
      return Response.json({ projectId: 7 });
    }

    const conversations =
      searchParams.get('project') === '7'
        ? [
            {
              id: 1,
              pinned: false,
              projectId: 7,
              running: false,
              title: 'bar',
              unread: false,
              waiting: false,
            },
          ]
        : [];

    return Response.json({ conversations, next: null });
  });

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
    routeTree: createRootRoute({
      component: () => (
        <TooltipProvider>
          <Sidebar
            collapsed={collapsed}
            onNavigate={() => undefined}
            onProject={onProject}
            onSelect={() => undefined}
            onToggle={() => undefined}
            selected={selected}
            user={{
              createdAt: new Date(0),
              email: 'foo@bar.com',
              emailVerified: true,
              id: 'foo',
              name: 'foo',
              updatedAt: new Date(0),
            }}
          />
        </TooltipProvider>
      ),
    }),
  });

  return renderWithQuery(<RouterProvider router={router} />);
}

test('clicking the open project collapses and expands its chats', async () => {
  const { screen } = await renderSidebar();

  const project = screen.getByRole('button', { name: 'foo', exact: true });

  await expect.element(screen.getByText('bar')).toBeVisible();

  await project.click();

  await expect.element(screen.getByText('bar')).not.toBeInTheDocument();
  await expect.element(project).toHaveAttribute('aria-expanded', 'false');

  await project.click();

  await expect.element(screen.getByText('bar')).toBeVisible();
});

test('clicking a project from one of its chats opens the project', async () => {
  const onProject = vi.fn();

  const { screen } = await renderSidebar({
    onProject,
    path: '/c/1',
    selected: 1,
  });

  await expect.element(screen.getByText('bar')).toBeVisible();

  await screen.getByRole('button', { name: 'foo', exact: true }).click();

  expect(onProject.mock.calls).toEqual([[7]]);

  await expect.element(screen.getByText('bar')).toBeVisible();
});

test('projects, apps and recent chats scroll together', async () => {
  const { screen } = await renderSidebar();

  await expect.element(screen.getByText('bar')).toBeVisible();

  const scroller = (name: string) =>
    screen
      .getByRole('navigation', { name })
      .element()
      .closest('.overflow-y-auto');

  const [projects, apps, chats] = ['Projects', 'Apps', 'Chats'].map(scroller);

  expect({ apps, chats, projects: projects?.tagName }).toEqual({
    apps: projects,
    chats: projects,
    projects: 'DIV',
  });
});

test('apps pinned to the sidebar link to their pages', async () => {
  const { screen } = await renderSidebar();

  await expect
    .element(screen.getByRole('link', { name: 'baz' }))
    .toHaveAttribute('href', '/apps/2/qux');

  await expect.element(screen.getByText('qux')).not.toBeInTheDocument();
});

test('the collapsed rail shows the mark at work and a dot when a chat needs you', async () => {
  const { screen } = await renderSidebar({ collapsed: true });

  const mark = screen.getByRole('button', { name: 'Expand sidebar' });

  await expect
    .poll(() =>
      [...mark.element().querySelectorAll<HTMLElement>('[data-slot]')].map(
        ({ dataset }) => [dataset.slot, dataset.state ?? dataset.tone]
      )
    )
    .toEqual([
      ['live-mark', 'thinking'],
      ['dot', 'attention'],
    ]);
});
