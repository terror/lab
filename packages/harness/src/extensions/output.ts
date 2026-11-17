import type { Context } from '@earendil-works/chord/context';
import {
  type ToolExecutionApi,
  type ToolExecutionResult,
  defineDoc,
  defineExtension,
  defineTool,
} from '@earendil-works/pi-durable';
import { int, obj, opt, str } from '@earendil-works/pi-schema';

export const TOOL_OUTPUT_LENGTH = 100_000;

const OUTPUT_LIMIT = 120_000;

const STORED_OUTPUTS = 20;

const STORED_LENGTH = 5_000_000;

export const OutputDoc = defineDoc<{ outputs: Record<string, string> }>({
  kind: 'lab.output',
  version: 1,
  scope: 'conversation',
  history: 'latest',
  fork: 'current',
  initial: () => ({ outputs: {} }),
  checkpointWhen: () => true,
});

type Output = NonNullable<ToolExecutionResult['output']>;

function textOf(output: Output) {
  return output.flatMap((part) => (part.type === 'text' ? [part.text] : []));
}

function page(text: string, callId: string, offset: number) {
  const end = Math.min(text.length, offset + TOOL_OUTPUT_LENGTH);

  const more =
    end < text.length
      ? `\n\n[Showing characters ${offset}–${end} of ${text.length}. Call tool_output_read with call_id "${callId}" and offset ${end} to read more.]`
      : `\n\n[End of output at character ${text.length}.]`;

  return `${text.slice(offset, end)}${more}`;
}

export async function limitOutput(
  result: ToolExecutionResult,
  api: ToolExecutionApi,
  context: Context
): Promise<ToolExecutionResult> {
  const texts = result.output && textOf(result.output);

  const text = texts?.join('\n\n') ?? '';

  if (!result.output || text.length <= OUTPUT_LIMIT) {
    return result;
  }

  await api.commit(async (tx) => {
    const doc = await tx.doc(OutputDoc, api.conversationId);

    const kept = Object.entries(doc.outputs).slice(-(STORED_OUTPUTS - 1));

    doc.outputs = Object.fromEntries([
      ...kept,
      [api.callId, text.slice(0, STORED_LENGTH)],
    ]);
  }, context);

  const images = result.output.filter((part) => part.type !== 'text');

  return {
    ...result,
    output: [
      { text: page(text, api.callId, 0), type: 'text' as const },
      ...images,
    ],
  };
}

const toolOutputRead = defineTool({
  name: 'tool_output_read',
  description:
    'Read more of a tool result that was too long to show in full, using the call id from its note.',
  parameters: obj({
    call_id: str({
      description: 'The call id named in the note.',
      maxLength: 200,
      minLength: 1,
    }),
    offset: opt(
      int({ description: 'Character offset to read from.', minimum: 0 })
    ),
  }),
  execute: async (args, api, context): Promise<ToolExecutionResult> => {
    const doc = await api.snapshot(OutputDoc, api.conversationId, context);

    const text = doc?.outputs[args.call_id];

    if (text === undefined) {
      return {
        isError: true,
        output: [
          {
            text: 'No stored output has that call id.',
            type: 'text' as const,
          },
        ],
      };
    }

    const start = Math.min(args.offset ?? 0, text.length);

    return {
      details: {
        end: Math.min(text.length, start + TOOL_OUTPUT_LENGTH),
        start,
        total: text.length,
      },
      output: [
        { text: page(text, args.call_id, start), type: 'text' as const },
      ],
    };
  },
});

export const output = defineExtension({
  name: 'lab.output',
  tools: [toolOutputRead],
});
