import {
  type ConversationId,
  type ToolExecutionResult,
  defineExtension,
  defineTool,
  section,
} from '@earendil-works/pi-durable';
import { int, obj, opt, str } from '@earendil-works/pi-schema';

export const PROJECT_NAME_LENGTH = 80;

export type ProjectSummary = { id: number; name: string };

export type ProjectAccess = {
  create(
    conversationId: ConversationId,
    name: string
  ): Promise<ProjectSummary | undefined>;
  current(conversationId: ConversationId): Promise<ProjectSummary | undefined>;
  list(conversationId: ConversationId): Promise<ProjectSummary[]>;
  move(
    conversationId: ConversationId,
    chatId: number,
    projectId: number | null
  ): Promise<boolean>;
  rename(
    conversationId: ConversationId,
    id: number,
    name: string
  ): Promise<ProjectSummary | undefined>;
};

function text(value: string) {
  return [{ text: value, type: 'text' as const }];
}

function failure(message: string): ToolExecutionResult {
  return { isError: true, output: text(message) };
}

function line({ id, name: projectName }: ProjectSummary) {
  return `[${id}] ${projectName}`;
}

const name = str({
  description: 'The project name.',
  maxLength: PROJECT_NAME_LENGTH,
  minLength: 1,
});

const projectId = int({ description: 'The project id.', minimum: 1 });

const missing = 'No project has that id.';

export function project(access: ProjectAccess) {
  const projectList = defineTool({
    name: 'project_list',
    description:
      "List the user's projects. Projects group related chats in the sidebar.",
    parameters: obj({}),
    execute: async (_args, api): Promise<ToolExecutionResult> => {
      const projects = await access.list(api.conversationId);

      return {
        details: { count: projects.length, projects },
        output: text(
          projects.length > 0
            ? projects.map(line).join('\n')
            : 'The user has no projects.'
        ),
      };
    },
  });

  const projectCreate = defineTool({
    name: 'project_create',
    description:
      'Create a new project. Use chat_move afterwards to put chats in it.',
    parameters: obj({ name }),
    execute: async (args, api, context): Promise<ToolExecutionResult> => {
      const created =
        (await api.memo<ProjectSummary>('project', context)) ??
        (await access.create(api.conversationId, args.name));

      if (!created) {
        return failure('The user has too many projects to create another.');
      }

      await api.memo('project', created, context);

      return {
        details: { project: created },
        output: text(`Created the new project ${line(created)}.`),
      };
    },
  });

  const projectRename = defineTool({
    name: 'project_rename',
    description: 'Rename a project.',
    parameters: obj({ id: projectId, name }),
    execute: async (args, api): Promise<ToolExecutionResult> => {
      const renamed = await access.rename(
        api.conversationId,
        args.id,
        args.name
      );

      return renamed
        ? {
            details: { project: renamed },
            output: text(`Renamed the project to ${line(renamed)}.`),
          }
        : failure(missing);
    },
  });

  const chatMove = defineTool({
    name: 'chat_move',
    description:
      'Move a chat into a project, or out of its project when project_id is omitted. Moves this chat unless chat_id is given.',
    parameters: obj({
      chat_id: opt(
        int({
          description: 'The chat to move. Defaults to this chat.',
          minimum: 1,
        })
      ),
      project_id: opt(projectId),
    }),
    execute: async (args, api): Promise<ToolExecutionResult> => {
      const chat = args.chat_id ?? api.conversationId;

      const target = args.project_id ?? null;

      const moved = await access.move(api.conversationId, chat, target);

      if (!moved) {
        return failure('No chat or project has that id.');
      }

      return {
        details: { chatId: chat, projectId: target },
        output: text(
          target === null
            ? `Moved chat ${chat} out of its project.`
            : `Moved chat ${chat} into project ${target}.`
        ),
      };
    },
  });

  return defineExtension({
    name: 'lab.project',
    sections: [
      section('project', async ({ conversationId }) => {
        const current = await access.current(conversationId);

        const place = current
          ? `This chat is in the user's project ${line(current)}.`
          : 'This chat is not in a project.';

        return `${place} You can list, create, and rename projects and move chats between them with project_list, project_create, project_rename, and chat_move.`;
      }),
    ],
    tools: [chatMove, projectCreate, projectList, projectRename],
  });
}
