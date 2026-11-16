import type { HelperUsage } from '../helper';
import { assistant } from './assistant';
import { type LibraryAccess, library } from './library';
import { memory } from './memory';
import { title } from './title';

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
  library: LibraryAccess;
  onHelperUsage: HelperUsage;
};

export function extensions({ library: access, onHelperUsage }: ExtensionDeps) {
  return [assistant, library(access), memory, title(onHelperUsage)];
}
