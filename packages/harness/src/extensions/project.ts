import {
  type ConversationId,
  type ToolExecutionResult,
  defineExtension,
  defineTool,
  section,
} from '@earendil-works/pi-durable';
import { int, obj, opt, str } from '@earendil-works/pi-schema';

export const PROJECT_INSTRUCTIONS_LENGTH = 8_000;

export const PROJECT_NAME_LENGTH = 80;

export type Project = { id: number; instructions: string; name: string };

export type ProjectChange = { instructions?: string; name?: string };

export type ChatMove = {
  chat: { id: number; title: string | null };
  project: Project | null;
};

export type ProjectAccess = {
  create(
    conversationId: ConversationId,
    name: string
  ): Promise<Project | undefined>;
  current(conversationId: ConversationId): Promise<Project | undefined>;
  list(conversationId: ConversationId): Promise<Project[]>;
  move(
    conversationId: ConversationId,
    chatId: number,
    projectId: number | null
  ): Promise<ChatMove | undefined>;
  update(
    conversationId: ConversationId,
    id: number,
    change: ProjectChange
  ): Promise<Project | undefined>;
};

function text(value: string) {
  return [{ text: value, type: 'text' as const }];
}

function failure(message: string): ToolExecutionResult {
  return { isError: true, output: text(message) };
}

function line({ id, name: projectName }: Project) {
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
        (await api.memo<Project>('project', context)) ??
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

  const projectUpdate = defineTool({
    name: 'project_update',
    description:
      'Rename a project or replace its instructions, which apply to every chat in it. Only the fields you pass change.',
    parameters: obj({
      id: projectId,
      instructions: opt(
        str({
          description:
            'The full new instructions. Pass an empty string to clear them.',
          maxLength: PROJECT_INSTRUCTIONS_LENGTH,
        })
      ),
      name: opt(name),
    }),
    execute: async ({ id, ...change }, api): Promise<ToolExecutionResult> => {
      if (change.instructions === undefined && change.name === undefined) {
        return failure('Pass a name or instructions to change.');
      }

      const updated = await access.update(api.conversationId, id, change);

      return updated
        ? {
            details: { project: updated },
            output: text(`Updated the project ${line(updated)}.`),
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
        details: moved,
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

        const tools =
          'You can list, create, rename, and change the instructions of projects and move chats between them with project_list, project_create, project_update, and chat_move.';

        if (!current) {
          return `This chat is not in a project. ${tools}`;
        }

        const instructions = current.instructions.trim();

        return [
          `This chat is in the user's project ${line(current)}. ${tools}`,
          instructions &&
            `The project's instructions apply to every chat in it and take precedence over the user's general custom instructions:\n${instructions}`,
        ]
          .filter(Boolean)
          .join('\n\n');
      }),
    ],
    tools: [chatMove, projectCreate, projectList, projectUpdate],
  });
}
