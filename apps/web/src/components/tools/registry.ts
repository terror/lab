import { Wrench } from 'lucide-react';

import { askRenderers } from './ask';
import { chatRenderers } from './chats';
import { codemodeRenderers } from './codemode';
import { libraryRenderers } from './library';
import { manageRenderers } from './manage';
import { memoryRenderers } from './memory';
import { type ToolName } from './names';
import { outputRenderers } from './output';
import { preferencesRenderers } from './preferences';
import { projectRenderers } from './project';
import { sandboxRenderers } from './sandbox';
import { scheduleRenderers } from './schedule';
import { skillRenderers } from './skills';
import type { FallbackRenderer, ToolRenderer } from './types';
import { webRenderers } from './web';

const renderers = {
  ...askRenderers,
  ...chatRenderers,
  ...codemodeRenderers,
  ...libraryRenderers,
  ...manageRenderers,
  ...memoryRenderers,
  ...outputRenderers,
  ...preferencesRenderers,
  ...projectRenderers,
  ...sandboxRenderers,
  ...scheduleRenderers,
  ...skillRenderers,
  ...webRenderers,
} satisfies Record<ToolName, ToolRenderer>;

function isToolName(name: string): name is ToolName {
  return name in renderers;
}

const fallback = (name: string): FallbackRenderer => ({
  icon: Wrench,
  title: ({ active }) => `${active ? 'Running' : 'Ran'} ${name}`,
});

export function toolRenderer(name: string): FallbackRenderer {
  return isToolName(name) ? renderers[name] : fallback(name);
}
