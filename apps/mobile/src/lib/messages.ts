import { z } from 'zod';

type Part = { type: string; text?: string };

type Entry = {
  data?: unknown;
  id: number;
  kind: string;
  model?: readonly { content: string | readonly Part[] }[];
};

export type Message = {
  id: number;
  role: 'assistant' | 'user';
  text: string;
};

const roles: Record<string, Message['role']> = {
  'lab.message': 'user',
  'pi.assistant': 'assistant',
  'pi.user': 'user',
};

const messageSchema = z.object({ text: z.string() });

function text(content: string | readonly Part[]) {
  if (typeof content === 'string') {
    return content;
  }

  return content
    .flatMap((part) => (part.type === 'text' && part.text ? [part.text] : []))
    .join('\n\n');
}

export function messages(entries: readonly Entry[]): Message[] {
  return entries.flatMap(({ data, id, kind, model }) => {
    const role = roles[kind];

    const content =
      messageSchema.safeParse(data).data?.text ?? model?.[0]?.content;

    if (!role || content === undefined) {
      return [];
    }

    const body = text(content).trim();

    return body ? [{ id, role, text: body }] : [];
  });
}
