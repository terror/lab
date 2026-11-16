import type { HelperUsage } from '../helper';
import { assistant } from './assistant';
import { title } from './title';

export { TitleDoc } from './title';

export function extensions(onHelperUsage: HelperUsage) {
  return [assistant, title(onHelperUsage)];
}
