import { assistant } from './assistant';
import { type Titles, title } from './title';

export { TitleDoc, type Titles } from './title';

export function extensions(titles: Titles) {
  return [assistant, title(titles)];
}
