import { LabMark } from '@/components/lab-mark';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { healthQueryOptions } from '@/lib/health';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

export function App() {
  const health = useQuery(healthQueryOptions);

  const status = health.isPending
    ? 'Connecting'
    : health.isError
      ? 'Disconnected'
      : 'Connected';

  return (
    <div className='min-h-svh bg-muted/30'>
      <header className='bg-background'>
        <div className='mx-auto flex h-16 max-w-5xl items-center gap-3 px-6'>
          <LabMark />
          <span className='text-lg font-semibold tracking-tight'>lab</span>
        </div>
      </header>
      <main className='mx-auto max-w-5xl px-6 py-12 sm:py-20'>
        <div className='max-w-lg space-y-8'>
          <div className='space-y-3'>
            <h1 className='text-3xl font-semibold tracking-tight sm:text-4xl'>
              A place for your agents.
            </h1>
            <p className='text-base leading-relaxed text-muted-foreground'>
              Your personal workspace for the things you want to explore,
              organize, and get done.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Connection</h2>
              </CardTitle>
              <CardDescription>
                {health.isError
                  ? 'Lab is unavailable. Try connecting again.'
                  : 'Stay connected to your workspace.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p role='status' className='flex items-center gap-2 text-sm'>
                <span
                  aria-hidden='true'
                  className={cn(
                    'size-2 rounded-full',
                    health.isPending
                      ? 'bg-muted-foreground motion-safe:animate-pulse'
                      : health.isError
                        ? 'bg-destructive'
                        : 'bg-emerald-600'
                  )}
                />
                {status}
              </p>
            </CardContent>
            <CardFooter>
              <Button
                variant='outline'
                disabled={health.isFetching}
                onClick={() => void health.refetch()}
              >
                <RefreshCw
                  aria-hidden='true'
                  className={cn(
                    health.isFetching && 'motion-safe:animate-spin'
                  )}
                />
                {health.isFetching ? 'Checking' : 'Check connection'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
}
