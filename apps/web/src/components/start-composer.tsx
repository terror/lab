import { Composer } from '@/components/composer';
import type { Attachment } from '@/lib/attachments';
import { useDraft, useStartChat } from '@/lib/conversations';
import { useChatModel } from '@/lib/models';
import { type Ref, useState } from 'react';

export function StartComposer({
  background = false,
  draft: draftKey,
  inputRef,
  placeholder,
  projectId,
  prompt = (content) => content,
}: {
  background?: boolean;
  draft: Parameters<typeof useDraft>[0];
  inputRef?: Ref<HTMLTextAreaElement>;
  placeholder?: string;
  projectId?: number;
  prompt?: (content: string) => string;
}) {
  const [draft, setDraft] = useDraft(draftKey);
  const [model, setModel] = useChatModel();
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const start = useStartChat({ projectId });

  const behind = useStartChat({ background: true, projectId });

  const send = async (via: typeof start, content: string) => {
    const sent = await via
      .mutateAsync({ attachments, content: prompt(content), model })
      .then(
        () => true,
        () => false
      );

    if (sent && draft.trim() === content) {
      setDraft('');
    }

    return sent;
  };

  return (
    <Composer
      attachments={attachments}
      draft={draft}
      error={(start.error ?? behind.error)?.message}
      inputRef={inputRef}
      model={model}
      onAttachmentsChange={setAttachments}
      onBackground={
        background
          ? async (content) => {
              if (await send(behind, content)) {
                setAttachments([]);
              }
            }
          : undefined
      }
      onDraftChange={(value) => {
        if (start.isError) {
          start.reset();
        }

        if (behind.isError) {
          behind.reset();
        }

        setDraft(value);
      }}
      onModelChange={setModel}
      onSubmit={(content) => void send(start, content)}
      placeholder={placeholder}
      submitting={start.isPending || behind.isPending}
    />
  );
}
