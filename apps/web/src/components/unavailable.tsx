import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Link } from '@tanstack/react-router';

const hints = {
  app: 'It may have been deleted with its chat. Deleted chats wait in the Trash until you restore them.',
  chat: 'It may have been deleted. Deleted chats wait in the Trash until you restore them.',
  project:
    'It may have been deleted. Deleted projects wait in the Trash until you restore them.',
};

export function Unavailable({ subject }: { subject: keyof typeof hints }) {
  return (
    <div className='flex flex-1 items-center justify-center px-6'>
      <EmptyState
        action={
          <div className='flex gap-2'>
            <Button asChild size='sm' variant='outline'>
              <Link search={{ section: 'trash' }} to='/settings'>
                Open Trash
              </Link>
            </Button>
            <Button asChild size='sm' variant='quiet'>
              <Link to='/'>New chat</Link>
            </Button>
          </div>
        }
        description={hints[subject]}
        title={`This ${subject} isn’t available`}
      />
    </div>
  );
}
