import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Conversation, JsonObject } from '@earendil-works/pi-durable';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { acceptsImages } from './models';
import {
  type Attachment,
  attachmentSchema,
  attachmentTextLimit,
} from './schemas';

export const draftSchema = z.object({
  attachments: z.array(attachmentSchema).max(8).default([]),
  content: z.string().trim(),
});

export function nonEmpty(draft: {
  attachments: Attachment[];
  content: string;
}) {
  return draft.content.length > 0 || draft.attachments.length > 0;
}

export const emptyMessage = {
  message: 'A message needs text or an attachment',
};

function escape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function prompt({
  attachments,
  content,
}: {
  attachments: Attachment[];
  content: string;
}) {
  const files = attachments
    .filter((attachment) => attachment.type === 'file')
    .map(({ name, text }) => `<file name="${escape(name)}">\n${text}\n</file>`);

  const images = attachments
    .filter((attachment) => attachment.type === 'image')
    .map(({ data, mimeType }) => ({ data, mimeType, type: 'image' as const }));

  const text = [content, ...files].filter(Boolean).join('\n\n');

  if (images.length === 0) {
    return text;
  }

  return text ? [{ text, type: 'text' as const }, ...images] : images;
}

export function checkAttachments(
  model: Parameters<typeof acceptsImages>[0],
  attachments: Attachment[]
) {
  if (
    attachments.some(({ type }) => type === 'image') &&
    !acceptsImages(model)
  ) {
    throw new HTTPException(400, { message: 'This model can’t read images' });
  }

  const text = attachments.reduce(
    (total, attachment) =>
      attachment.type === 'file' ? total + attachment.text.length : total,
    0
  );

  if (text > attachmentTextLimit(model?.contextWindow)) {
    throw new HTTPException(400, {
      message: `These files have too much text for ${model?.name ?? 'this model'}`,
    });
  }
}

function entryFile(attachment: Attachment): JsonObject {
  if (attachment.type === 'file') {
    return {
      name: attachment.name,
      text: attachment.text,
      type: 'file',
    };
  }

  return { name: attachment.name, type: 'image' };
}

export function submitMessage(
  conversation: Conversation,
  draft: { attachments: Attachment[]; content: string },
  whenBusy: 'followUp' | 'steer' = 'followUp'
) {
  return conversation.submit(
    {
      type: 'input',
      whenBusy,
      content: prompt(draft),
      entry: {
        kind: 'lab.message',
        data: {
          files: draft.attachments.map(entryFile),
          text: draft.content,
        },
      },
    },
    BACKGROUND_CONTEXT
  );
}
