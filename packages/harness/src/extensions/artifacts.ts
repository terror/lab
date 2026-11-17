import {
  type ToolExecutionResult,
  defineDoc,
  defineExtension,
  defineTool,
  section,
} from '@earendil-works/pi-durable';
import { arr, int, obj, opt, str } from '@earendil-works/pi-schema';

import { failure, text } from './results';

export const ARTIFACT_LENGTH = 300_000;

const ARTIFACT_LIMIT = 50;

export type Artifact = {
  content: string;
  kind: 'html';
  title: string;
  version: number;
};

export const ArtifactsDoc = defineDoc<{ artifacts: Record<string, Artifact> }>({
  kind: 'lab.artifacts',
  version: 1,
  scope: 'conversation',
  history: 'latest',
  fork: 'current',
  initial: () => ({ artifacts: {} }),
  checkpointWhen: () => true,
});

const artifactCreate = defineTool({
  name: 'artifact_create',
  description:
    'Show the user an interactive HTML artifact (an app, calculator, chart, game, visualization, or page) rendered live in the chat. Write one complete HTML document with inline CSS and JavaScript.',
  parameters: obj({
    content: str({
      description:
        'The complete HTML document, with all CSS and JavaScript inline.',
      maxLength: ARTIFACT_LENGTH,
      minLength: 1,
    }),
    id: str({
      description:
        'A short id for the artifact, lowercase letters, digits, and dashes, unique in this chat.',
      maxLength: 40,
      minLength: 1,
      pattern: '^[a-z0-9-]+$',
    }),
    title: str({
      description: 'A short title shown above the artifact.',
      maxLength: 100,
      minLength: 1,
    }),
  }),
  execute: async (
    { content, id, title },
    api,
    context
  ): Promise<ToolExecutionResult> => {
    const result = await api.commit(async (tx) => {
      const doc = await tx.doc(ArtifactsDoc, api.conversationId);

      if (doc.artifacts[id]) {
        return 'exists';
      }

      if (Object.keys(doc.artifacts).length >= ARTIFACT_LIMIT) {
        return 'full';
      }

      doc.artifacts[id] = { content, kind: 'html', title, version: 1 };

      return 'created';
    }, context);

    if (result === 'exists') {
      return failure(`An artifact with the id "${id}" already exists.`);
    }

    if (result === 'full') {
      return failure(`This chat already has ${ARTIFACT_LIMIT} artifacts.`);
    }

    return {
      details: { id, size: content.length, title, version: 1 },
      output: text(
        `Showed the artifact "${title}" (${id}, version 1, ${content.length} characters) to the user.`
      ),
    };
  },
});

const artifactId = str({
  description: 'The artifact id.',
  maxLength: 40,
  minLength: 1,
  pattern: '^[a-z0-9-]+$',
});

type Edit = { new: string; old: string };

function applyEdits(content: string, edits: readonly Edit[]) {
  return edits.reduce<{ content: string } | { error: string }>(
    (current, edit, index) => {
      if ('error' in current) {
        return current;
      }

      const matches = current.content.split(edit.old).length - 1;

      if (matches !== 1) {
        return {
          error: `Edit ${index + 1} must match exactly once, but its old text matches ${matches} times.`,
        };
      }

      return { content: current.content.replace(edit.old, () => edit.new) };
    },
    { content }
  );
}

const artifactUpdate = defineTool({
  name: 'artifact_update',
  description:
    'Change an artifact you created and show the new version. Prefer small edits, each replacing text that appears exactly once; pass content only to rewrite the whole document.',
  parameters: obj({
    content: opt(
      str({
        description: 'The complete new HTML document.',
        maxLength: ARTIFACT_LENGTH,
        minLength: 1,
      })
    ),
    edits: opt(
      arr(
        obj({
          new: str({
            description: 'The replacement text.',
            maxLength: ARTIFACT_LENGTH,
          }),
          old: str({
            description:
              'Text that appears exactly once in the current version.',
            maxLength: ARTIFACT_LENGTH,
            minLength: 1,
          }),
        }),
        { maxItems: 50, minItems: 1 }
      )
    ),
    id: artifactId,
    title: opt(
      str({ description: 'A new title.', maxLength: 100, minLength: 1 })
    ),
  }),
  execute: async (args, api, context): Promise<ToolExecutionResult> => {
    if ((args.content === undefined) === (args.edits === undefined)) {
      return failure('Pass either edits or content.');
    }

    const result = await api.commit(async (tx) => {
      const doc = await tx.doc(ArtifactsDoc, api.conversationId);

      const current = doc.artifacts[args.id];

      if (!current) {
        return { error: `No artifact has the id "${args.id}".` };
      }

      const next = args.edits
        ? applyEdits(current.content, args.edits)
        : { content: args.content ?? current.content };

      if ('error' in next || next.content.length > ARTIFACT_LENGTH) {
        return 'error' in next
          ? next
          : { error: 'The updated artifact is too long.' };
      }

      const updated = {
        ...current,
        content: next.content,
        title: args.title ?? current.title,
        version: current.version + 1,
      };

      doc.artifacts[args.id] = updated;

      return { artifact: updated };
    }, context);

    if ('error' in result) {
      return failure(result.error);
    }

    const { content, title, version } = result.artifact;

    return {
      details: { content, id: args.id, size: content.length, title, version },
      output: text(
        `Updated the artifact "${title}" (${args.id}) to version ${version}, ${content.length} characters.`
      ),
    };
  },
});

const artifactRead = defineTool({
  name: 'artifact_read',
  description:
    'Read the current HTML of an artifact in this chat, for example before editing one created earlier.',
  parameters: obj({
    id: artifactId,
    offset: opt(
      int({ description: 'Character offset to read from.', minimum: 0 })
    ),
  }),
  execute: async (args, api, context): Promise<ToolExecutionResult> => {
    const doc = await api.snapshot(ArtifactsDoc, api.conversationId, context);

    const artifact = doc?.artifacts[args.id];

    if (!artifact) {
      return failure(`No artifact has the id "${args.id}".`);
    }

    return {
      details: {
        id: args.id,
        title: artifact.title,
        version: artifact.version,
      },
      output: text(
        `"${artifact.title}" version ${artifact.version}:\n\n${artifact.content.slice(args.offset ?? 0)}`
      ),
    };
  },
});

export const artifacts = defineExtension({
  name: 'lab.artifacts',
  sections: [
    section(
      'artifacts',
      () =>
        'Use artifact_create when an interactive app, tool, chart, game, or visual would help more than text, and artifact_update with small edits to change one; use a ```mermaid code block for simple diagrams. Artifacts run in a sandbox with no network access, so put all data, CSS, and JavaScript inline and never load external scripts, fonts, or images; the only libraries available are Chart.js 4 at <script src="/frame/vendor/chart.js"></script> and D3 7 at <script src="/frame/vendor/d3.js"></script>. They sit on the chat background, so keep the background transparent and style with the CSS variables --background, --foreground, --muted, --muted-foreground, --border, and --primary, which follow the user\'s theme. Use semantic, labelled HTML and make it work at phone width. From a click handler, lab.send(text) puts a follow-up message in the user\'s message box, for example to ask about a selected item. From a click handler, lab.send(text) puts a follow-up message in the user\'s message box, for example to ask about a selected item.'
    ),
  ],
  tools: [artifactCreate, artifactRead, artifactUpdate],
});
