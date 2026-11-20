import { type LucideIcon } from 'lucide-react';
import { createContext, type ReactNode } from 'react';

export type ToolResult = {
  details?: unknown;
  output: string;
  span?: { end: number; start: number };
  status: 'done' | 'failed' | 'stopped';
};

export type ToolProgress = {
  details?: unknown;
  output?: string;
  status: 'pending' | 'running' | 'done';
};

export type ToolRecord = {
  args: Record<string, unknown>;
  details: unknown;
  name: string;
};

export const ToolHistory = createContext<readonly ToolRecord[]>([]);

export const ToolConversation = createContext<number | undefined>(undefined);

export type ToolView = {
  active: boolean;
  args: Record<string, unknown>;
  callId: string;
  details: unknown;
  history: readonly ToolRecord[];
  output: string;
};

type Render = (view: ToolView) => ReactNode;

type ToolLabel = {
  actions?: ReactNode;
  icon: LucideIcon;
  summary?: (view: ToolView) => string | undefined;
  tally?: (count: number) => string;
  title: (view: ToolView) => string;
  yields?: 'file' | 'source';
};

export type ToolRenderer = ToolLabel &
  ({ inline: Render; preview?: Render } | { inline?: Render; preview: Render });

export type FallbackRenderer = ToolLabel & {
  inline?: Render;
  preview?: Render;
};
