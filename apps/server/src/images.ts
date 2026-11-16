import type { ConversationView, EntryRecord } from '@earendil-works/pi-durable';

type Part = { data?: string; type: string };

function stripPart(part: Part): Part {
  return part.type === 'image' ? { ...part, data: '' } : part;
}

export function stripImages(entry: EntryRecord): EntryRecord {
  const message = entry.model?.[0];

  if (
    !message ||
    typeof message.content === 'string' ||
    !message.content.some(({ type }) => type === 'image')
  ) {
    return entry;
  }

  return {
    ...entry,
    model: [
      { ...message, content: message.content.map(stripPart) },
      ...(entry.model?.slice(1) ?? []),
    ] as EntryRecord['model'],
  };
}

export function stripView(view: ConversationView): ConversationView {
  return { ...view, entries: view.entries.map(stripImages) };
}

export function imageAt(entry: EntryRecord | undefined, index: number) {
  const content = entry?.model?.[0]?.content;

  if (!Array.isArray(content)) {
    return undefined;
  }

  const images = content.flatMap((part) =>
    part.type === 'image' ? [part] : []
  );

  return images[index];
}
