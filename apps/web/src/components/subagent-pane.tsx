import { IconButton } from '@/components/ui/icon-button';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { StatusIcon } from '@/components/ui/status-icon';
import { useMediaQuery } from '@/lib/media';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Lock, X } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ToolProgress, ToolResult } from './tools';
import {
  laneState,
  reportedSubagents,
  states,
  type Subagent,
} from './tools/delegate';

type Lanes = { active: boolean; lanes: Subagent[] };

const footers = {
  done: 'Read-only. Lab has this subagent’s report.',
  failed: 'Read-only. No report reached Lab.',
  running: 'Read-only. Lab reads this subagent’s report when it finishes.',
  stopped: 'Read-only. This subagent stopped before it reported.',
};

function holding(
  agent: number,
  calls: Iterable<{ details?: unknown }>
): Subagent[] | undefined {
  return [...calls]
    .map(({ details }) => reportedSubagents(details))
    .find((lanes) => lanes?.some(({ id }) => id === agent));
}

export function lanesOf(
  agent: number,
  results: ReadonlyMap<string, ToolResult>,
  progress: ReadonlyMap<string, ToolProgress>
): Lanes {
  const settled = holding(agent, results.values());

  if (settled) {
    return { active: false, lanes: settled };
  }

  return { active: true, lanes: holding(agent, progress.values()) ?? [] };
}

export function SubagentPane({
  agent,
  children,
  lanes: { active, lanes },
  onClose,
  onOpen,
}: {
  agent: number;
  children: ReactNode;
  lanes: Lanes;
  onClose: () => void;
  onOpen: (agent: number) => void;
}) {
  const index = lanes.findIndex(({ id }) => id === agent);

  const lane = lanes[index];

  const state = laneState(lane?.status ?? 'running', active);

  const step = (offset: number) => {
    const next = lanes[(index + offset + lanes.length) % lanes.length]?.id;

    if (next !== undefined) {
      onOpen(next);
    }
  };

  return (
    <section
      aria-label='Subagent'
      className='flex h-full min-h-0 flex-col bg-background'
    >
      <header className='flex shrink-0 flex-col border-b py-2 pr-2 pl-4'>
        <div className='flex h-8 items-center gap-2'>
          <StatusIcon status={state} />
          <h2 className='min-w-0 truncate text-sm font-medium'>
            {lane?.title ?? 'Subagent'}
          </h2>
          <IconButton
            className='ml-auto'
            label='Close'
            onClick={onClose}
            size='icon-sm'
          >
            <X aria-hidden='true' />
          </IconButton>
        </div>
        <div className='flex h-7 items-center gap-1 pl-6 text-xs whitespace-nowrap text-muted-foreground'>
          <span className={cn(state === 'failed' && 'text-destructive')}>
            {states[state].label}
          </span>
          <span className='truncate'>· Subagent of this chat</span>
          {lanes.length > 1 && index >= 0 && (
            <span className='ml-auto flex items-center'>
              <span className='mr-1 tabular-nums'>
                {index + 1} of {lanes.length}
              </span>
              <IconButton
                label='Previous subagent'
                onClick={() => step(-1)}
                size='icon-xs'
              >
                <ChevronLeft aria-hidden='true' />
              </IconButton>
              <IconButton
                label='Next subagent'
                onClick={() => step(1)}
                size='icon-xs'
              >
                <ChevronRight aria-hidden='true' />
              </IconButton>
            </span>
          )}
        </div>
      </header>
      <div className='flex min-h-0 flex-1 flex-col'>{children}</div>
      <footer className='flex shrink-0 items-center gap-2 border-t px-4 py-3 text-xs text-muted-foreground'>
        <Lock aria-hidden='true' className='size-3.5 shrink-0' />
        {footers[state]}
      </footer>
    </section>
  );
}

export function SubagentSplit({
  children,
  onClose,
  pane,
}: {
  children: ReactNode;
  onClose: () => void;
  pane: ReactNode;
}) {
  const desktop = useMediaQuery('(min-width: 768px)');

  const open = Boolean(pane);

  if (!desktop) {
    return (
      <>
        {children}
        <Sheet
          onOpenChange={(shown) => {
            if (!shown) {
              onClose();
            }
          }}
          open={open}
        >
          <SheetContent
            className='top-11 gap-0 overflow-hidden rounded-t-2xl p-0'
            onOpenAutoFocus={(event) => {
              event.preventDefault();

              if (event.currentTarget instanceof HTMLElement) {
                event.currentTarget.focus();
              }
            }}
            showCloseButton={false}
            side='bottom'
          >
            <SheetTitle className='sr-only'>Subagent</SheetTitle>
            <SheetDescription className='sr-only'>
              A read-only view of this subagent’s work
            </SheetDescription>
            {pane}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <ResizablePanelGroup orientation='horizontal'>
      <ResizablePanel className='flex flex-col' id='chat' minSize='40%'>
        {children}
      </ResizablePanel>
      {open && (
        <>
          <ResizableHandle />
          <ResizablePanel defaultSize={440} id='subagent' minSize={360}>
            {pane}
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
