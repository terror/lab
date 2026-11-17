import { usePreference } from '@/lib/preferences';
import { Suspense, use } from 'react';
import type { StreamdownProps } from 'streamdown';

type Modules = {
  plugins: StreamdownProps['plugins'];
  streamdown: typeof import('streamdown');
};

let loaded: Modules | undefined;

let loading: Promise<Modules> | undefined;

function darkMode() {
  return document.documentElement.classList.contains('dark');
}

const mermaid: NonNullable<StreamdownProps['plugins']>['mermaid'] = {
  getMermaid: (config) => ({
    initialize: () => undefined,
    render: async (id, source) => {
      const { default: renderer } = await import('mermaid');

      renderer.initialize({
        ...config,
        securityLevel: 'strict',
        startOnLoad: false,
        theme: darkMode() ? 'dark' : 'neutral',
      });

      return renderer.render(id, source);
    },
  }),
  language: 'mermaid',
  name: 'mermaid',
  type: 'diagram',
};

export function loadMarkdown() {
  loading ??= Promise.all([
    import('streamdown'),
    import('@streamdown/code'),
  ]).then(([streamdown, { code }]) => {
    loaded = { plugins: { code, mermaid }, streamdown };

    return loaded;
  });

  return loading;
}

const linkSafety = { enabled: false };

function Streamdown(props: StreamdownProps) {
  const { plugins, streamdown } = loaded ?? use(loadMarkdown());

  return (
    <streamdown.Streamdown
      linkSafety={linkSafety}
      plugins={plugins}
      {...props}
    />
  );
}

export function Markdown({
  children,
  streaming,
}: {
  children: string;
  streaming: boolean;
}) {
  const [lineNumbers] = usePreference('lineNumbers');

  return (
    <Suspense fallback={<div className='whitespace-pre-wrap'>{children}</div>}>
      <Streamdown
        animated={
          streaming && { animation: 'fadeIn', duration: 240, sep: 'word' }
        }
        isAnimating={streaming}
        lineNumbers={lineNumbers}
      >
        {children}
      </Streamdown>
    </Suspense>
  );
}
