import type { HelperUsage } from '../helper';
import { assistant } from './assistant';
import { memory } from './memory';
import { title } from './title';

export { MEMORY_LENGTH, MEMORY_LIMIT, MemoryDoc, memory } from './memory';
export { TitleDoc } from './title';

export function extensions(onHelperUsage: HelperUsage) {
  return [assistant, memory, title(onHelperUsage)];
}
