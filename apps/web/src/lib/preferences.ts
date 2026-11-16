import { z } from 'zod';

import { usePersistentState } from './storage';

const lineNumbersSchema = z.boolean();

export function useLineNumbers() {
  return usePersistentState('line-numbers', lineNumbersSchema, false);
}
