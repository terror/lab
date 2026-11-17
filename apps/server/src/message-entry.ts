import type { EntryRecord } from '@earendil-works/pi-durable';
import { z } from 'zod';

export const MESSAGE_KIND = 'lab.message';

const messageDataSchema = z.object({
  files: z
    .array(
      z.object({
        name: z.string(),
        text: z.string().optional(),
        type: z.enum(['file', 'image']),
        uploadId: z.string().optional(),
      })
    )
    .default([]),
  text: z.string().default(''),
});

export type MessageData = z.infer<typeof messageDataSchema>;

export function isMessage(entry: EntryRecord) {
  return entry.kind === MESSAGE_KIND;
}

export function messageData(entry: EntryRecord) {
  return isMessage(entry)
    ? messageDataSchema.safeParse(entry.data).data
    : undefined;
}
