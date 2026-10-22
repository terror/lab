import { useRenameSession } from '@/hooks/use-sessions';
import type { SessionMetadata } from '@lab/shared';
import { useEffect, useRef, useState } from 'react';

export function useSessionTitle(session: SessionMetadata, onClose: () => void) {
  const [title, setTitle] = useState(session.title);
  const input = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const finished = useRef(false);
  const rename = useRenameSession();

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  function cancel() {
    if (saving.current) {
      return;
    }

    finished.current = true;
    onClose();
  }

  async function save() {
    if (saving.current || finished.current) {
      return;
    }

    if (title.trim() === session.title) {
      cancel();
      return;
    }

    saving.current = true;

    try {
      await rename.mutateAsync({
        sessionId: session.sessionId,
        title: title.trim(),
      });

      finished.current = true;
      onClose();
    } catch {
      return;
    } finally {
      saving.current = false;
    }
  }

  return { title, setTitle, input, save, cancel, saving: rename.isPending };
}
