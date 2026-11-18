import { usePreference } from '@/lib/preferences';
import { useDark } from '@/lib/theme';
import { Suspense, use, useState } from 'react';
import type { DiagramPlugin, StreamdownProps } from 'streamdown';

type Modules = {
  plugins: Record<'dark' | 'light', StreamdownProps['plugins']>;
  remarkPlugins: StreamdownProps['remarkPlugins'];
  streamdown: typeof import('streamdown');
};

type Loading = Promise<Modules> & { status?: 'fulfilled'; value?: Modules };

let loading: Loading | undefined;

function diagrams(theme: 'dark' | 'neutral'): DiagramPlugin {
  return {
    getMermaid: (config) => ({
      initialize: () => undefined,
      render: async (id, source) => {
        const { default: renderer } = await import('mermaid');

        renderer.initialize({
          ...config,
          securityLevel: 'strict',
          startOnLoad: false,
          theme,
        });

        return renderer.render(id, source);
      },
    }),
    language: 'mermaid',
    name: 'mermaid',
    type: 'diagram',
  };
}

export function loadMarkdown(): Promise<Modules> {
  if (loading) {
    return loading;
  }

  const started: Loading = Promise.all([
    import('streamdown'),
    import('@streamdown/code'),
    import('remark-breaks'),
  ]).then(
    ([streamdown, { code }, { default: remarkBreaks }]) => {
      const modules: Modules = {
        plugins: {
          dark: { code, mermaid: diagrams('dark') },
          light: { code, mermaid: diagrams('neutral') },
        },
        remarkPlugins: [
          ...Object.values(streamdown.defaultRemarkPlugins),
          remarkBreaks,
        ],
        streamdown,
      };

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

const linkSafety = { enabled: false };

function Streamdown(props: StreamdownProps) {
  const { plugins, remarkPlugins, streamdown } = use(loadMarkdown());
  const dark = useDark();

  return (
    <streamdown.Streamdown
      linkSafety={linkSafety}
      plugins={plugins[dark ? 'dark' : 'light']}
      remarkPlugins={remarkPlugins}
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
  const [streamed, setStreamed] = useState(streaming);

  if (streaming && !streamed) {
    setStreamed(true);
  }

  return (
    <Suspense fallback={<div className='whitespace-pre-wrap'>{children}</div>}>
      <Streamdown
        animated={
          streaming && { animation: 'fadeIn', duration: 240, sep: 'word' }
        }
        data-streaming={streamed ? streaming : undefined}
        isAnimating={streaming}
        lineNumbers={lineNumbers}
        parseIncompleteMarkdown={streaming}
      >
        {children}
      </Streamdown>
    </Suspense>
  );
}
