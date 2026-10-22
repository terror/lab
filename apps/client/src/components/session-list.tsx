import { ErrorNotice } from '@/components/error-notice';
import { SessionListItem } from '@/components/session-list-item';
import { useSessions } from '@/hooks/use-sessions';

function dateGroup(date: string) {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const days = (today.getTime() - new Date(date).getTime()) / 86_400_000;

  return days < 0
    ? 'Today'
    : days < 1
      ? 'Yesterday'
      : days < 7
        ? 'Previous 7 days'
        : 'Earlier';
}

export function SessionList({
  workspaceId,
  selectedId,
  onSelect,
  onDeleted,
}: {
  workspaceId: string;
  selectedId: string | null;
  onSelect: (sessionId: string) => void;
  onDeleted: (sessionId: string) => void;
}) {
  const sessions = useSessions(workspaceId);

  const groups = Map.groupBy(sessions.data ?? [], (session) =>
    dateGroup(session.updatedAt)
  );

  return (
    <nav
      aria-label='Chat history'
      className='min-h-0 flex-1 overflow-y-auto px-3 pt-5 pb-4'
    >
      {sessions.isPending ? (
        <div
          role='status'
          aria-label='Loading chats'
          className='space-y-3 px-2'
        >
          {[80, 95, 65, 85].map((width, index) => (
            <div
              key={index}
              className='h-4 rounded bg-sidebar-accent motion-safe:animate-pulse'
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      ) : sessions.error && !sessions.data ? (
        <ErrorNotice
          error={sessions.error}
          onRetry={() => void sessions.refetch()}
        />
      ) : (
        Array.from(groups, ([label, items]) => (
          <div key={label} className='mb-5'>
            <h2 className='mb-1.5 px-2.5 text-[11px] font-medium text-muted-foreground'>
              {label}
            </h2>
            <ul className='space-y-0.5'>
              {items.map((session) => (
                <SessionListItem
                  key={session.sessionId}
                  session={session}
                  selected={selectedId === session.sessionId}
                  onSelect={onSelect}
                  onDeleted={onDeleted}
                />
              ))}
            </ul>
          </div>
        ))
      )}
    </nav>
  );
}
