import {
  type PersistedStateOptions,
  usePersistedState,
} from '@/hooks/use-persisted-state';
import { useLayoutEffect, useRef } from 'react';
import { z } from 'zod';

const draftSchema = z.string();

export function draftState(key: string): PersistedStateOptions<string> {
  return {
    key: `lab:draft:${key}`,
    defaultValue: '',
    schema: draftSchema,
    storage: 'session',
    format: 'text',
  };
}

export function useComposer(key: string) {
  const [text, setText] = usePersistedState(draftState(key));

  const textarea = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = '0px';
      textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 240)}px`;
    }
  }, [text]);

  return { text, setText, textarea };
}
