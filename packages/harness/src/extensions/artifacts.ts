import {
  type ToolExecutionResult,
  defineDoc,
  defineExtension,
  defineTool,
  section,
} from '@earendil-works/pi-durable';
import { obj, str } from '@earendil-works/pi-schema';

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

function text(value: string) {
  return [{ text: value, type: 'text' as const }];
}

function failure(message: string): ToolExecutionResult {
  return { isError: true, output: text(message) };
}

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

export const artifacts = defineExtension({
  name: 'lab.artifacts',
  sections: [
    section(
      'artifacts',
      () =>
        "Use artifact_create when an interactive app, tool, chart, game, or visual would help more than text; use a ```mermaid code block for simple diagrams. Artifacts run in a sandbox with no network access, so put all data, CSS, and JavaScript inline and never load external scripts, fonts, or images. They sit on the chat background, so keep the background transparent and style with the CSS variables --background, --foreground, --muted, --muted-foreground, --border, and --primary, which follow the user's theme. Use semantic, labelled HTML and make it work at phone width."
    ),
  ],
  tools: [artifactCreate],
});
