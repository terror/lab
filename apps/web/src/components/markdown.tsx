import { usePreference } from '@/lib/preferences';
import { useDark } from '@/lib/theme';
import { Suspense, use } from 'react';
import type { DiagramPlugin, StreamdownProps } from 'streamdown';

type Modules = {
  plugins: Record<'dark' | 'light', StreamdownProps['plugins']>;
  remarkPlugins: StreamdownProps['remarkPlugins'];
  streamdown: typeof import('streamdown');
};

let loaded: Modules | undefined;

let loading: Promise<Modules> | undefined;

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

export function loadMarkdown() {
  loading ??= Promise.all([
    import('streamdown'),
    import('@streamdown/code'),
    import('remark-breaks'),
  ]).then(
    ([streamdown, { code }, { default: remarkBreaks }]) => {
      loaded = {
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

      return loaded;
    },
    (error: unknown) => {
      loading = undefined;

      throw error;
    }
  );

  return loading;
}

const linkSafety = { enabled: false };

function Streamdown(props: StreamdownProps) {
  const { plugins, remarkPlugins, streamdown } = loaded ?? use(loadMarkdown());
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

  return (
    <Suspense fallback={<div className='whitespace-pre-wrap'>{children}</div>}>
      <Streamdown
        animated={
          streaming && { animation: 'fadeIn', duration: 240, sep: 'word' }
        }
        isAnimating={streaming}
        lineNumbers={lineNumbers}
        parseIncompleteMarkdown={streaming}
      >
        {children}
      </Streamdown>
    </Suspense>
  );
}
