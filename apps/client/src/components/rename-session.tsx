import { useSessionTitle } from '@/hooks/use-session-title';
import type { SessionMetadata } from '@lab/shared';
import { LoaderCircle } from 'lucide-react';

export function RenameSession({
  session,
  onClose,
}: {
  session: SessionMetadata;
  onClose: () => void;
}) {
  const editor = useSessionTitle(session, onClose);

  return (
    <form
      className='relative min-w-0 flex-1'
      onSubmit={(event) => {
        event.preventDefault();
        void editor.save();
      }}
    >
      <input
        ref={editor.input}
        aria-label='Chat name'
        aria-busy={editor.saving}
        maxLength={200}
        value={editor.title}
        readOnly={editor.saving}
        onChange={(event) => editor.setTitle(event.target.value)}
        onBlur={() => void editor.save()}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) {
            if (event.key === 'Enter') {
              event.preventDefault();
            }

            return;
          }

          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            editor.cancel();
          }
        }}
        className='w-full rounded-lg bg-transparent px-2.5 py-2.5 pr-8 text-[13px] outline-none focus-visible:outline-none'
        placeholder='New chat'
      />
      {editor.saving && (
        <LoaderCircle
          aria-label='Saving name'
          className='absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground motion-safe:animate-spin'
        />
      )}
    </form>
  );
}
