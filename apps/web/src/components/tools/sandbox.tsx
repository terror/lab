import { DocumentCard } from '@/components/document-card';
import { uploadUrl } from '@/lib/uploads';
import {
  Download,
  FilePen,
  FileText,
  FolderTree,
  SquareTerminal,
  Upload,
} from 'lucide-react';

import {
  bytes,
  count,
  field,
  pathTitle,
  readRange,
  seconds,
  text,
} from './format';
import { PreviewPassage } from './previews';
import { type ToolRenderer, type ToolView } from './types';

function Terminal({ active, args, output }: ToolView) {
  const command = text(args.command) ?? '';

  const body = active ? output : output.replace(/^Exit code[^\n]*\n*/, '');

  return (
    <pre className='max-h-80 overflow-auto rounded-xl bg-muted/40 px-3.5 py-3 font-mono text-xs/relaxed whitespace-pre-wrap text-foreground/80'>
      <span className='text-muted-foreground'>$ </span>
      {command}
      {body && `\n${body.trimEnd()}`}
    </pre>
  );
}

function SavedFile({ details }: ToolView) {
  const uploadId = text(field(details, 'uploadId'));

  const name = text(field(details, 'name')) ?? 'file';

  const type = text(field(details, 'mimeType')) ?? '';

  const size = count(field(details, 'size'));

  if (!uploadId) {
    return undefined;
  }

  if (type.startsWith('image/')) {
    return (
      <img
        alt={name}
        className='max-h-72 self-start rounded-xl border object-contain'
        src={uploadUrl(uploadId)}
      />
    );
  }

  if (type === 'application/pdf') {
    return <DocumentCard name={name} uploadId={uploadId} />;
  }

  return (
    <a
      className='flex items-center gap-3 self-start rounded-xl border px-3 py-2 text-sm transition-colors hover:bg-muted/50'
      download={name}
      href={uploadUrl(uploadId)}
    >
      <FileText aria-hidden='true' className='size-4 text-muted-foreground' />
      <span className='truncate'>{name}</span>
      {size !== undefined && (
        <span className='text-xs text-muted-foreground'>
          {bytes.format(size)}
        </span>
      )}
    </a>
  );
}

function Listing({ output }: ToolView) {
  return output ? (
    <pre className='max-h-64 overflow-auto rounded-xl bg-muted/40 px-3.5 py-3 font-mono text-xs/relaxed whitespace-pre-wrap text-foreground/80'>
      {output}
    </pre>
  ) : undefined;
}

export const sandboxRenderers: Record<string, ToolRenderer> = {
  sandbox_exec: {
    icon: SquareTerminal,
    preview: (view) => <Terminal {...view} />,
    summary: ({ details }) => {
      const code = count(field(details, 'exitCode'));

      const time = seconds(field(details, 'durationMs'));

      return code === undefined
        ? undefined
        : `exit ${code}${time ? ` · ${time}` : ''}`;
    },
    title: ({ active, args }) => {
      const command = text(args.command)?.split('\n')[0] ?? 'a command';

      return `${active ? 'Running' : 'Ran'} ${command}`;
    },
  },
  sandbox_list: {
    icon: FolderTree,
    preview: (view) => <Listing {...view} />,
    title: ({ active, args }) =>
      `${active ? 'Listing' : 'Listed'} ${text(args.path) ?? 'files'}`,
  },
  sandbox_read: {
    icon: FileText,
    preview: ({ details }) => {
      const passage = text(field(details, 'passage'));

      return passage ? <PreviewPassage>{passage}</PreviewPassage> : undefined;
    },
    summary: ({ details }) => readRange(details),
    title: pathTitle('Reading a file', 'Read'),
  },
  sandbox_save: {
    icon: Download,
    inline: (view) => <SavedFile {...view} />,
    title: ({ active, details }) => {
      const name = text(field(details, 'name'));

      if (active) {
        return 'Saving a file';
      }

      return name ? `Saved ${name} to your library` : 'Saved a file';
    },
  },
  sandbox_upload: {
    icon: Upload,
    title: pathTitle('Copying a library file', 'Copied a library file to'),
  },
  sandbox_write: {
    icon: FilePen,
    summary: ({ details }) => {
      const size = count(field(details, 'size'));

      return size === undefined ? undefined : bytes.format(size);
    },
    title: pathTitle('Writing a file', 'Wrote'),
  },
};
