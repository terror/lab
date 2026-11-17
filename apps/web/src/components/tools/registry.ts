import { Wrench } from 'lucide-react';

import { askRenderers } from './ask';
import { chatRenderers } from './chats';
import { codemodeRenderers } from './codemode';
import { libraryRenderers } from './library';
import { memoryRenderers } from './memory';
import { sandboxRenderers } from './sandbox';
import { skillRenderers } from './skills';
import type { ToolRenderer } from './types';
import { webRenderers } from './web';

const renderers: Partial<Record<string, ToolRenderer>> = {
  ...askRenderers,
  ...chatRenderers,
  ...codemodeRenderers,
  ...libraryRenderers,
  ...memoryRenderers,
  ...sandboxRenderers,
  ...skillRenderers,
  ...webRenderers,
};

const fallback = (name: string): ToolRenderer => ({
  icon: Wrench,
  title: ({ active }) => `${active ? 'Running' : 'Ran'} ${name}`,
});

export function toolRenderer(name: string): ToolRenderer {
  return renderers[name] ?? fallback(name);
}
