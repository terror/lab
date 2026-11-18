import { Composer } from '@/components/composer';
import type { Attachment } from '@/lib/attachments';
import { useDraft, useStartChat } from '@/lib/conversations';
import { useChatModel } from '@/lib/models';
import { type Ref, useState } from 'react';

export function StartComposer({
  draft: draftKey,
  inputRef,
  placeholder,
  projectId,
  prompt = (content) => content,
}: {
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

  return (
    <Composer
      attachments={attachments}
      draft={draft}
      error={start.error?.message}
      inputRef={inputRef}
      model={model}
      onAttachmentsChange={setAttachments}
      onDraftChange={(value) => {
        if (start.isError) {
          start.reset();
        }

        setDraft(value);
      }}
      onModelChange={setModel}
      onSubmit={async (content) => {
        const sent = await start
          .mutateAsync({ attachments, content: prompt(content), model })
          .then(
            () => true,
            () => false
          );

        if (sent && draft.trim() === content) {
          setDraft('');
        }
      }}
      placeholder={placeholder}
      submitting={start.isPending}
    />
  );
}
