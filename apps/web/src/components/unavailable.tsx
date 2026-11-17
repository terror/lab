import { Button } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';

export function Unavailable({ subject }: { subject: 'chat' | 'project' }) {
  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center'>
      <p className='text-sm font-medium'>This {subject} isn't available</p>
      <p className='max-w-sm text-sm text-muted-foreground'>
        It may have been deleted. Deleted {subject}s can be restored from the
        Trash in Settings.
      </p>
      <Button asChild size='sm' variant='secondary'>
        <Link to='/'>New chat</Link>
      </Button>
    </div>
  );
}
