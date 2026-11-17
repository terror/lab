import { Folder } from 'lucide-react';

import { count, field, plural, text } from './format';
import type { ToolRenderer, ToolView } from './types';

function projectTitle(running: string, done: string) {
  return ({ active, details }: ToolView) => {
    const name = text(field(field(details, 'project'), 'name'));

    if (active || !name) {
      return running;
    }

    return `${done} “${name}”`;
  };
}

export const projectRenderers: Record<string, ToolRenderer> = {
  chat_move: {
    icon: Folder,
    title: ({ active, details }) => {
      if (active) {
        return 'Moving a chat';
      }

      return field(details, 'projectId') === null
        ? 'Moved a chat out of its project'
        : 'Moved a chat into a project';
    },
  },
  project_create: {
    icon: Folder,
    title: projectTitle('Creating a project', 'Created'),
  },
  project_list: {
    icon: Folder,
    summary: ({ details }) => {
      const found = count(field(details, 'count'));

      return found === undefined ? undefined : plural(found, 'project');
    },
    title: ({ active }) => (active ? 'Listing projects' : 'Listed projects'),
  },
  project_rename: {
    icon: Folder,
    title: projectTitle('Renaming a project', 'Renamed to'),
  },
};
