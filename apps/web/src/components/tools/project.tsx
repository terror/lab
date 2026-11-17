import { conversationTitle } from '@/lib/conversations';
import { plural } from '@/lib/format';
import { Folder } from 'lucide-react';

import { count, field, namedTitle, text } from './format';
import { PreviewList } from './previews';
import type { ToolRenderer, ToolView } from './types';

function projectItem(project: unknown, index: number) {
  const id = count(field(project, 'id'));

  return {
    key: String(id ?? index),
    label: text(field(project, 'name')) ?? 'Untitled project',
    projectId: id,
  };
}

function projectPreview({ details }: ToolView) {
  const project = field(details, 'project');

  return project ? (
    <PreviewList items={[projectItem(project, 0)]} />
  ) : undefined;
}

const projectTitle = namedTitle(({ details }) =>
  field(field(details, 'project'), 'name')
);

export const projectRenderers = {
  chat_move: {
    icon: Folder,
    preview: ({ details }) => {
      const chat = field(details, 'chat');

      const id = count(field(chat, 'id'));

      if (id === undefined) {
        return undefined;
      }

      const project = field(details, 'project');

      return (
        <PreviewList
          items={[
            {
              chatId: id,
              key: String(id),
              label: conversationTitle(text(field(chat, 'title')) ?? null),
              meta: text(field(project, 'name')) ?? 'No project',
            },
          ]}
        />
      );
    },
    title: ({ active, details }) => {
      if (active) {
        return 'Moving a chat';
      }

      return field(details, 'project') === null
        ? 'Moved a chat out of its project'
        : 'Moved a chat into a project';
    },
  },
  project_create: {
    icon: Folder,
    preview: projectPreview,
    title: projectTitle('Creating a project', 'Created'),
  },
  project_delete: {
    icon: Folder,
    preview: ({ details }) => {
      const project = field(details, 'project');

      const chats = count(field(details, 'chats'));

      return project ? (
        <PreviewList
          items={[
            {
              ...projectItem(project, 0),
              meta:
                chats === undefined
                  ? 'In Trash'
                  : `${plural(chats, 'chat')} in Trash`,
              projectId: undefined,
            },
          ]}
        />
      ) : undefined;
    },
    title: ({ active }) =>
      active ? 'Deleting a project' : 'Moved a project to Trash',
  },
  project_list: {
    icon: Folder,
    preview: ({ details }) => {
      const projects = field(details, 'projects');

      return Array.isArray(projects) ? (
        <PreviewList items={projects.map(projectItem)} />
      ) : undefined;
    },
    summary: ({ details }) => {
      const found = count(field(details, 'count'));

      return found === undefined ? undefined : plural(found, 'project');
    },
    title: ({ active }) => (active ? 'Listing projects' : 'Listed projects'),
  },
  project_update: {
    icon: Folder,
    preview: projectPreview,
    title: projectTitle('Updating a project', 'Updated'),
  },
} satisfies Record<string, ToolRenderer>;
