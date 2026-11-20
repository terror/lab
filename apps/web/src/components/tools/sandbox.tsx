import { DocumentCard } from '@/components/document-card';
import { FileChip } from '@/components/file-chip';
import { ImageCard } from '@/components/image-card';
import { formatBytes, plural } from '@/lib/format';
import { uploadUrl } from '@/lib/uploads';
import {
  Download,
  FilePen,
  FileText,
  FolderTree,
  SquareTerminal,
  Upload,
} from 'lucide-react';

import { count, field, pathTitle, readRange, seconds, text } from './format';
import { PreviewCode, PreviewList, PreviewPassage } from './previews';
import { type ToolRenderer, type ToolView } from './types';

function Terminal({ active, args, output }: ToolView) {
  const command = text(args.command) ?? '';

  const body = active ? output : output.replace(/^Exit code[^\n]*\n*/, '');

  return (
    <pre className='max-h-80 overflow-auto rounded-card bg-foreground/4 px-3.5 py-3 font-mono text-xs/relaxed whitespace-pre-wrap text-foreground/80'>
      <span className='text-muted-foreground'>$ </span>
      {command}
      {body && `\n${body.trimEnd()}`}
    </pre>
  );
}

export function SavedFile({ details }: ToolView) {
  const uploadId = text(field(details, 'uploadId'));

  const name = text(field(details, 'name')) ?? 'file';

  const type = text(field(details, 'mimeType')) ?? '';

  const size = count(field(details, 'size'));

  if (!uploadId) {
    return undefined;
  }

  if (type.startsWith('image/')) {
    return (
      <ImageCard className='max-h-72' name={name} src={uploadUrl(uploadId)} />
    );
  }

  if (type === 'application/pdf') {
    return <DocumentCard name={name} uploadId={uploadId} />;
  }

  return <FileChip href={uploadUrl(uploadId)} name={name} size={size} />;
}

function Listing({ output }: ToolView) {
  return output ? (
    <pre className='max-h-64 overflow-auto rounded-card bg-foreground/4 px-3.5 py-3 font-mono text-xs/relaxed whitespace-pre-wrap text-foreground/80'>
      {output}
    </pre>
  ) : undefined;
}

function filePreview({ details }: ToolView) {
  const filePath = text(field(details, 'path'));

  const size = count(field(details, 'size'));

  if (!filePath) {
    return undefined;
  }

  return (
    <PreviewList
      items={[
        {
          key: filePath,
          label: filePath,
          meta: size === undefined ? undefined : formatBytes(size),
        },
      ]}
    />
  );
}

export const sandboxRenderers = {
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
    tally: (commands) => `ran ${plural(commands, 'command')}`,
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
    yields: 'file',
  },
  sandbox_upload: {
    icon: Upload,
    preview: filePreview,
    title: pathTitle('Copying a library file', 'Copied a library file to'),
  },
  sandbox_write: {
    icon: FilePen,
    preview: (view) => {
      const content = text(field(view.args, 'content'));

      return content ? <PreviewCode>{content}</PreviewCode> : filePreview(view);
    },
    summary: ({ details }) => {
      const size = count(field(details, 'size'));

      return size === undefined ? undefined : formatBytes(size);
    },
    title: pathTitle('Writing a file', 'Wrote'),
  },
} satisfies Record<string, ToolRenderer>;
