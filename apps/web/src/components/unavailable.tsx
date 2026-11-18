import { Button } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';

const hints = {
  app: 'It may have been deleted with its chat. Deleted chats can be restored from the Trash in Settings.',
  chat: 'It may have been deleted. Deleted chats can be restored from the Trash in Settings.',
  project:
    'It may have been deleted. Deleted projects can be restored from the Trash in Settings.',
};

export function Unavailable({ subject }: { subject: keyof typeof hints }) {
  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center'>
      <p className='text-sm font-medium'>This {subject} isn't available</p>
      <p className='max-w-sm text-sm text-muted-foreground'>{hints[subject]}</p>
      <Button asChild size='sm' variant='secondary'>
        <Link to='/'>New chat</Link>
      </Button>
    </div>
  );
}
