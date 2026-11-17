import { SandboxFrame } from '@/components/sandbox-frame';
import { Code, Download, Eye, LayoutTemplate } from 'lucide-react';
import { useState } from 'react';

import { count, field, text } from './format';
import { PreviewCode } from './previews';
import type { ToolRenderer, ToolView } from './types';

function download(title: string, html: string) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));

  const link = document.createElement('a');

  link.href = url;
  link.download = `${title.replaceAll(/[^\w-]+/g, '-').toLowerCase()}.html`;
  link.click();

  URL.revokeObjectURL(url);
}

const action =
  'flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground';

function ArtifactCard({ active, args, details }: ToolView) {
  const [showCode, setShowCode] = useState(false);

  const html = text(field(args, 'content')) ?? '';

  const title = text(field(args, 'title')) ?? 'Artifact';

  if (active) {
    return (
      <div className='flex items-center gap-2 rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground'>
        <LayoutTemplate aria-hidden='true' className='size-4' />
        <span className='truncate'>Building {title}</span>
        <span className='ml-auto tabular-nums'>
          {html.length.toLocaleString()} characters
        </span>
      </div>
    );
  }

  if (count(field(details, 'version')) === undefined) {
    return undefined;
  }

  return (
    <section
      aria-label={title}
      className='group/artifact flex flex-col overflow-hidden rounded-xl bg-muted/40'
    >
      <header className='flex items-center gap-2 px-4 py-2'>
        <LayoutTemplate
          aria-hidden='true'
          className='size-4 text-muted-foreground'
        />
        <h3 className='truncate text-sm font-medium'>{title}</h3>
        <div className='ml-auto flex items-center gap-1 opacity-0 transition-opacity group-focus-within/artifact:opacity-100 group-hover/artifact:opacity-100 pointer-coarse:opacity-100'>
          <button
            aria-label={showCode ? 'Show preview' : 'Show code'}
            className={action}
            onClick={() => setShowCode(!showCode)}
            type='button'
          >
            {showCode ? (
              <Eye aria-hidden='true' className='size-4' />
            ) : (
              <Code aria-hidden='true' className='size-4' />
            )}
          </button>
          <button
            aria-label='Download'
            className={action}
            onClick={() => download(title, html)}
            type='button'
          >
            <Download aria-hidden='true' className='size-4' />
          </button>
        </div>
      </header>
      <div className='px-4 pb-4'>
        {showCode && <PreviewCode>{html}</PreviewCode>}
        <div hidden={showCode}>
          <SandboxFrame html={html} title={title} />
        </div>
      </div>
    </section>
  );
}

export const artifactRenderers = {
  artifact_create: {
    icon: LayoutTemplate,
    inline: (view) => <ArtifactCard {...view} />,
    title: ({ active, args }) => {
      const title = text(field(args, 'title'));

      if (active) {
        return 'Building an artifact';
      }

      return title ? `Built “${title}”` : 'Built an artifact';
    },
  },
} satisfies Record<string, ToolRenderer>;
