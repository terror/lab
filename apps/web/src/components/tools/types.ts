import { type LucideIcon } from 'lucide-react';
import { createContext, type ReactNode } from 'react';

export type ToolResult = {
  details?: unknown;
  isError: boolean;
  output: string;
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

export type ToolRenderer = {
  actions?: ReactNode;
  inline?: (view: ToolView) => ReactNode;
  preview?: (view: ToolView) => ReactNode;
  icon: LucideIcon;
  summary?: (view: ToolView) => string | undefined;
  title: (view: ToolView) => string;
};
