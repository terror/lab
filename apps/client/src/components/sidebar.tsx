import { LabMark } from '@/components/lab-mark';
import { SessionList } from '@/components/session-list';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/user-menu';
import { PanelLeftClose, SquarePen } from 'lucide-react';

export function Sidebar({
  workspaceId,
  sessionId,
  onSession,
  onNewChat,
  onCollapse,
}: {
  workspaceId: string;
  sessionId: string | null;
  onSession: (id: string) => void;
  onNewChat: () => void;
  onCollapse: () => void;
}) {
  return (
    <div className='flex h-full w-full flex-col bg-sidebar text-sidebar-foreground select-none'>
      <div className='flex h-16 shrink-0 items-center gap-2.5 px-5'>
        <LabMark className='size-7' />
        <Button
          variant='ghost'
          size='icon'
          className='ml-auto'
          aria-label='Collapse sidebar'
          title='Collapse sidebar'
          onClick={onCollapse}
        >
          <PanelLeftClose />
        </Button>
      </div>
      <div className='px-4 pt-3'>
        <Button
          variant='ghost'
          className='h-10 w-full justify-start gap-2.5 rounded-lg px-3'
          onClick={onNewChat}
        >
          <SquarePen className='size-4' />
          New chat
        </Button>
      </div>
      <SessionList
        key={workspaceId}
        workspaceId={workspaceId}
        selectedId={sessionId}
        onSelect={onSession}
        onDeleted={(id) => {
          if (id === sessionId) {
            onNewChat();
          }
        }}
      />
      <div className='shrink-0 p-3'>
        <UserMenu />
      </div>
    </div>
  );
}
