import { usePreference } from '@/lib/preferences';
import { useQuiet } from '@/lib/voice';
import { Suspense, use, useEffect, useRef, useState } from 'react';

type Modules = typeof import('./markdown-renderer');

type Loading = Promise<Modules> & { status?: 'fulfilled'; value?: Modules };

let loading: Loading | undefined;

export function loadMarkdown(): Promise<Modules> {
  if (loading) {
    return loading;
  }

  const started: Loading = import('./markdown-renderer').then(
    (modules) => {
      started.status = 'fulfilled';
      started.value = modules;

      return modules;
    },
    (error: unknown) => {
      loading = undefined;

      throw error;
    }
  );

  loading = started;

  return started;
}

const scrollable = [
  ['[data-markdown=code-block] pre', 'Code'],
  ['[data-markdown=table]', 'Table'],
] as const;

function enhanceMarkdown(root: HTMLElement) {
  for (const [selector, label] of scrollable) {
    for (const scroller of root.querySelectorAll(
      `${selector}:not([tabindex])`
    )) {
      scroller.setAttribute('aria-label', label);
      if (label === 'Code') {
        scroller.setAttribute('role', 'group');
      }
      scroller.setAttribute('tabindex', '0');
    }
  }

  for (const link of root.querySelectorAll<HTMLAnchorElement>(
    'a[data-markdown=a][href]:not([target])'
  )) {
    if (link.origin !== location.origin) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
  }
}

function useMarkdownRoot() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;

    if (!root) {
      return undefined;
    }

    enhanceMarkdown(root);

    const observer = new MutationObserver(() => enhanceMarkdown(root));

    observer.observe(root, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return ref;
}

function Renderer(props: React.ComponentProps<Modules['MarkdownRenderer']>) {
  const { MarkdownRenderer } = use(loadMarkdown());

  return <MarkdownRenderer {...props} />;
}

export function Markdown({
  children,
  streaming,
}: {
  children: string;
  streaming: boolean;
}) {
  const [lineNumbers] = usePreference('lineNumbers');
  const [streamed] = useState(streaming);
  const quiet = useQuiet();
  const root = useMarkdownRoot();

  return (
    <div className='contents' ref={root}>
      <Suspense
        fallback={<div className='whitespace-pre-wrap'>{children}</div>}
      >
        <Renderer
          animated={streaming && { animation: 'fadeIn', duration: 240 }}
          data-reply-streaming={streamed && !quiet ? streaming : undefined}
          isAnimating={streaming}
          lineNumbers={lineNumbers}
          parseIncompleteMarkdown={streaming}
        >
          {children}
        </Renderer>
      </Suspense>
    </div>
  );
}
