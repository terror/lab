import { LabMark } from '@/components/lab-mark';
import { StartComposer } from '@/components/start-composer';
import { UnreadChips } from '@/components/unread-chips';

function greeting(name: string) {
  const hour = new Date().getHours();
  const first = name.split(' ')[0] || name;

  if (hour < 5) {
    return `Up late, ${first}?`;
  }

  if (hour < 12) {
    return `Good morning, ${first}`;
  }

  if (hour < 18) {
    return `Good afternoon, ${first}`;
  }

  return `Good evening, ${first}`;
}

export function NewChat({ user }: { user: { name: string } }) {
  return (
    <div className='flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 pb-24'>
      <div className='flex w-full max-w-3xl flex-col items-center gap-8'>
        <div className='flex animate-in flex-col items-center gap-4 text-center duration-500 fade-in slide-in-from-bottom-2'>
          <LabMark className='size-10' />
          <h1 className='text-3xl font-semibold tracking-tight text-balance sm:text-4xl'>
            {greeting(user.name)}
          </h1>
        </div>
        <div className='relative w-full'>
          <StartComposer draft='new' />
          <div className='absolute inset-x-0 top-full mt-4 flex flex-col items-center gap-2'>
            <UnreadChips />
          </div>
        </div>
      </div>
    </div>
  );
}