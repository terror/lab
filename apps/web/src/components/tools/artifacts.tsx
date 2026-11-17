import { SandboxFrame } from '@/components/sandbox-frame';
import { Code, Download, Eye, LayoutTemplate } from 'lucide-react';
import { useState } from 'react';

import { count, field, text } from './format';
import { PreviewCode, PreviewList } from './previews';
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

type Shown = { html: string; id: string; title: string; version: number };

function shown({ args, details, name }: ToolView & { name: string }) {
  const id = text(field(args, 'id')) ?? '';

  const version = count(field(details, 'version'));

  if (version === undefined) {
    return undefined;
  }

  const fromArgs = name === 'artifact_create';

  return {
    html: text(field(fromArgs ? args : details, 'content')) ?? '',
    id,
    title: text(field(details, 'title')) ?? 'Artifact',
    version,
  };
}

function latestVersion(history: ToolView['history'], id: string) {
  return Math.max(
    0,
    ...history
      .filter(
        (record) =>
          record.name.startsWith('artifact_') &&
          text(field(record.args, 'id')) === id
      )
      .map((record) => count(field(record.details, 'version')) ?? 0)
  );
}

function Building({ html, title }: { html: string; title: string }) {
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

function Superseded({ artifact }: { artifact: Shown }) {
  const [showCode, setShowCode] = useState(false);

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
        <LayoutTemplate aria-hidden='true' className='size-4' />
        <span className='truncate'>
          {artifact.title} · version {artifact.version} · updated below
        </span>
        <button
          aria-label={showCode ? 'Hide code' : 'Show code'}
          className={action}
          onClick={() => setShowCode(!showCode)}
          type='button'
        >
          <Code aria-hidden='true' className='size-4' />
        </button>
      </div>
      {showCode && <PreviewCode>{artifact.html}</PreviewCode>}
    </div>
  );
}

function Live({ artifact }: { artifact: Shown }) {
  const [showCode, setShowCode] = useState(false);

  const { html, title, version } = artifact;

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
        {version > 1 && (
          <span className='text-xs text-muted-foreground'>v{version}</span>
        )}
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

function artifactCard(name: string) {
  return (view: ToolView) => {
    if (view.active) {
      const title = text(field(view.args, 'title')) ?? 'an artifact';

      return (
        <Building
          html={text(field(view.args, 'content')) ?? ''}
          title={title}
        />
      );
    }

    const artifact = shown({ ...view, name });

    if (!artifact) {
      return undefined;
    }

    return artifact.version < latestVersion(view.history, artifact.id) ? (
      <Superseded artifact={artifact} />
    ) : (
      <Live artifact={artifact} />
    );
  };
}

function artifactTitle(running: string, done: string) {
  return ({ active, args, details }: ToolView) => {
    const title = text(field(details, 'title')) ?? text(field(args, 'title'));

    if (active) {
      return running;
    }

    return title ? `${done} “${title}”` : `${done} an artifact`;
  };
}

export const artifactRenderers = {
  artifact_create: {
    icon: LayoutTemplate,
    inline: artifactCard('artifact_create'),
    title: artifactTitle('Building an artifact', 'Built'),
  },
  artifact_read: {
    icon: LayoutTemplate,
    preview: ({ details }) => {
      const title = text(field(details, 'title'));

      return title ? (
        <PreviewList
          items={[
            {
              key: title,
              label: title,
              meta: `version ${count(field(details, 'version')) ?? 1}`,
            },
          ]}
        />
      ) : undefined;
    },
    title: artifactTitle('Reading an artifact', 'Read'),
  },
  artifact_update: {
    icon: LayoutTemplate,
    inline: artifactCard('artifact_update'),
    title: artifactTitle('Updating an artifact', 'Updated'),
  },
} satisfies Record<string, ToolRenderer>;
