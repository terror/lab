import { assistant } from './assistant';
import { title } from './title';
import { createWebExtension } from './web';

export { TitleDoc } from './title';

export function createExtensions({
  searchApiKey,
}: {
  searchApiKey: string | undefined;
}) {
  return [assistant, title, createWebExtension(searchApiKey)];
}
