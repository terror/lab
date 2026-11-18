import { Cable, PackageSearch, Wrench } from 'lucide-react';

import { artifactRenderers } from './artifacts';
import { askRenderers } from './ask';
import { chatRenderers } from './chats';
import { codemodeRenderers } from './codemode';
import { connectorRenderers } from './connectors';
import { imageRenderers } from './images';
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
  ...artifactRenderers,
  ...askRenderers,
  ...chatRenderers,
  ...codemodeRenderers,
  ...connectorRenderers,
  ...imageRenderers,
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

const connectorTool = /^mcp__(.+?)__(.+)$/;

function fallback(name: string): FallbackRenderer {
  if (name === 'tool_search') {
    return {
      icon: PackageSearch,
      title: ({ active }) => (active ? 'Finding tools' : 'Found tools'),
    };
  }

  const [, connector, tool] = connectorTool.exec(name) ?? [];

  if (connector && tool) {
    return {
      icon: Cable,
      title: ({ active }) =>
        `${active ? 'Using' : 'Used'} ${tool} from ${connector}`,
    };
  }

  return {
    icon: Wrench,
    title: ({ active }) => `${active ? 'Running' : 'Ran'} ${name}`,
  };
}

export function toolRenderer(name: string): FallbackRenderer {
  return isToolName(name) ? renderers[name] : fallback(name);
}
