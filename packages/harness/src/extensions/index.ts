import type { HelperUsage } from '../helper';
import { assistant } from './assistant';
import { codemode } from './codemode';
import { compaction } from './compaction';
import { type HistoryAccess, history } from './history';
import { type LibraryAccess, library } from './library';
import { memory } from './memory';
import { title } from './title';

export {
  type ChatMatch,
  type ChatTranscript,
  type HistoryAccess,
} from './history';
export {
  type LibraryAccess,
  type LibraryContent,
  type LibraryEntry,
  READ_LENGTH,
  library,
} from './library';
export { MEMORY_LENGTH, MEMORY_LIMIT, MemoryDoc, memory } from './memory';
export { TitleDoc } from './title';

export type ExtensionDeps = {
  history: HistoryAccess;
  library: LibraryAccess;
  onHelperUsage: HelperUsage;
};

export function extensions({
  history: chats,
  library: access,
  onHelperUsage,
}: ExtensionDeps) {
  return [
    assistant,
    codemode,
    compaction(onHelperUsage),
    history(chats),
    library(access),
    memory,
    title(onHelperUsage),
  ];
}
