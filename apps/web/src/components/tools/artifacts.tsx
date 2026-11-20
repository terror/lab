import {
  PinMenu,
  useAppStatus,
  useSeenVersion,
} from '@/components/artifact-apps';
import { type FrameCall, SandboxFrame } from '@/components/sandbox-frame';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Peek } from '@/components/ui/peek';
import { Sigil } from '@/components/ui/sigil';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusNote } from '@/components/ui/status-note';
import { appSeed, artifactCalls } from '@/lib/artifacts';
import { useDraft } from '@/lib/conversations';
import { plural } from '@/lib/format';
import { useLibraryImages } from '@/lib/library';
import { useMoment } from '@/lib/moment';
import { Link } from '@tanstack/react-router';
import {
  AppWindow,
  Code,
  Download,
  Eye,
  LayoutTemplate,
  Maximize2,
  TriangleAlert,
} from 'lucide-react';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { count, field, namedTitle, text } from './format';
import { PreviewCode, PreviewList } from './previews';
import { type ToolRenderer, type ToolView, ToolConversation } from './types';

function download(title: string, html: string) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));

  const link = document.createElement('a');

  link.href = url;
  link.download = `${title.replaceAll(/[^\w-]+/g, '-').toLowerCase()}.html`;
  link.click();

  URL.revokeObjectURL(url);
}

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

const PREVIEW_HEIGHT = 360;

const PREVIEW_INTERVAL = 400;

function useThrottled(value: string) {
  const [throttled, setThrottled] = useState(value);
  const latest = useRef(value);

  useEffect(() => {
    latest.current = value;
  }, [value]);

  useEffect(() => {
    const timer = setInterval(
      () => setThrottled(latest.current),
      PREVIEW_INTERVAL
    );

    return () => clearInterval(timer);
  }, []);

  return throttled;
}

const built = new Set<string>();

const CELL_CHARACTERS = 600;

function BuildingFace({ id, length }: { id?: string; length: number }) {
  const conversationId = useContext(ToolConversation);
  const face = useMoment('apps.face').on;

  if (conversationId === undefined || !id || !face) {
    return undefined;
  }

  return (
    <Sigil
      filled={Math.floor(length / CELL_CHARACTERS) + 1}
      kind='app'
      seed={appSeed(conversationId, id)}
    />
  );
}

function Building({
  callId,
  html,
  id,
  title,
}: {
  callId: string;
  html: string;
  id?: string;
  title: string;
}) {
  const partial = useThrottled(html);

  useEffect(() => {
    built.add(callId);
  }, [callId]);

  return (
    <Card className='gap-0 overflow-hidden p-0' variant='inset'>
      <div className='flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground'>
        <BuildingFace id={id} length={html.length} />
        <span className='truncate'>Building {title}</span>
        <span className='ml-auto tabular-nums'>
          {html.length.toLocaleString()} characters
        </span>
      </div>
      <div className='px-4 pb-4'>
        {partial.length > 0 ? (
          <SandboxFrame
            height={PREVIEW_HEIGHT}
            html={partial}
            preview
            scripts={false}
            title={`${title} preview`}
          />
        ) : (
          <Skeleton
            className='rounded-card'
            style={{ height: PREVIEW_HEIGHT }}
          />
        )}
      </div>
    </Card>
  );
}

function Superseded({ artifact }: { artifact: Shown }) {
  const [showCode, setShowCode] = useState(false);

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
        <span className='truncate'>
          {artifact.title} · version {artifact.version} · updated below
        </span>
        <Button
          aria-label={showCode ? 'Hide code' : 'Show code'}
          onClick={() => setShowCode(!showCode)}
          size='icon-sm'
          variant='quiet'
        >
          <Code aria-hidden='true' />
        </Button>
      </div>
      {showCode && <PreviewCode>{artifact.html}</PreviewCode>}
    </div>
  );
}

function FullScreen({
  artifact,
  onCall,
  onClose,
  status,
}: {
  artifact: Shown;
  onCall?: FrameCall;
  onClose: () => void;
  status?: string;
}) {
  const html = useLibraryImages(artifact.html);

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent
        className='flex flex-col gap-3'
        onOpenAutoFocus={(event) => {
          event.preventDefault();

          if (event.currentTarget instanceof HTMLElement) {
            event.currentTarget.focus();
          }
        }}
        style={{ height: '90dvh', maxWidth: 'min(72rem, calc(100vw - 2rem))' }}
      >
        <DialogHeader>
          <div className='flex min-w-0 items-center gap-2'>
            <DialogTitle className='truncate'>{artifact.title}</DialogTitle>
            <StatusNote>{status}</StatusNote>
          </div>
          <DialogDescription className='sr-only'>
            Full screen view of the artifact
          </DialogDescription>
        </DialogHeader>
        <div className='min-h-0 flex-1 overflow-y-auto'>
          {html !== undefined && (
            <SandboxFrame html={html} onCall={onCall} title={artifact.title} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ERROR_LIMIT = 5;

function fixRequest(title: string, errors: readonly string[]) {
  return [
    `The artifact "${title}" reported ${errors.length === 1 ? 'an error' : 'errors'}:`,
    ...errors.map((error) => `- ${error}`),
    'Please fix it.',
  ].join('\n');
}

function Errors({
  errors,
  onFix,
}: {
  errors: readonly string[];
  onFix: () => void;
}) {
  return (
    <div className='flex flex-col gap-2 border-t px-4 py-3 text-sm'>
      <div className='flex items-center gap-2'>
        <TriangleAlert
          aria-hidden='true'
          className='size-4 text-muted-foreground'
        />
        <span>
          {errors.length === 1 ? '1 error' : `${errors.length} errors`}
        </span>
        <Button className='ml-auto' onClick={onFix} size='sm' variant='quiet'>
          Fix with Lab
        </Button>
      </div>
      <ul className='flex flex-col gap-1 font-mono text-xs text-muted-foreground'>
        {errors.map((error) => (
          <li key={error} className='truncate'>
            {error}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Live({ artifact, callId }: { artifact: Shown; callId: string }) {
  const [arrival] = useState(() => built.has(callId));
  const develop = useMoment('apps.develop').on;
  const glide = useMoment('apps.glide').on;
  const peek = useMoment('apps.peek').on;
  const [showCode, setShowCode] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const conversationId = useContext(ToolConversation);
  const [draft, setDraft] = useDraft(conversationId ?? 'new');
  const { asking, status } = useAppStatus(conversationId, artifact.id);

  useSeenVersion(conversationId, artifact.id);

  const onCall = useMemo(
    () =>
      conversationId === undefined
        ? undefined
        : artifactCalls(conversationId, artifact.id),
    [artifact.id, conversationId]
  );

  const addToDraft = (message: string) =>
    setDraft(draft.trim() ? `${draft.trimEnd()}\n\n${message}` : message);

  const onError = useCallback((message: string) => {
    setErrors((current) =>
      current.includes(message) || current.length >= ERROR_LIMIT
        ? current
        : [...current, message]
    );
  }, []);

  const { title, version } = artifact;

  const html = useLibraryImages(artifact.html);

  useEffect(() => {
    built.delete(callId);
  }, [callId]);

  return (
    <section aria-label={title} className='group/artifact relative'>
      <Peek className='right-4' rise={peek} shown={asking} />
      <Card className='gap-0 overflow-hidden p-0' variant='inset'>
        <header className='flex items-center gap-2 px-4 py-2'>
          <h3 className='truncate text-sm font-medium'>{title}</h3>
          {version > 1 && (
            <span className='text-xs text-muted-foreground'>v{version}</span>
          )}
          <StatusNote>{status}</StatusNote>
          <div className='ml-auto flex items-center gap-1 hover-reveal group-focus-within/artifact:opacity-100 group-hover/artifact:opacity-100'>
            <Button
              aria-label={showCode ? 'Show preview' : 'Show code'}
              onClick={() => setShowCode(!showCode)}
              size='icon-sm'
              variant='quiet'
            >
              {showCode ? (
                <Eye aria-hidden='true' />
              ) : (
                <Code aria-hidden='true' />
              )}
            </Button>
            <Button
              aria-label='Download'
              onClick={() => download(title, html ?? artifact.html)}
              size='icon-sm'
              variant='quiet'
            >
              <Download aria-hidden='true' />
            </Button>
            <Button
              aria-label='Full screen'
              onClick={() => setFullScreen(true)}
              size='icon-sm'
              variant='quiet'
            >
              <Maximize2 aria-hidden='true' />
            </Button>
            {conversationId !== undefined && (
              <>
                <Button asChild size='icon-sm' variant='quiet'>
                  <Link
                    aria-label='Open as page'
                    params={{ artifactId: artifact.id, conversationId }}
                    to='/apps/$conversationId/$artifactId'
                  >
                    <AppWindow aria-hidden='true' />
                  </Link>
                </Button>
                <PinMenu
                  artifactId={artifact.id}
                  className={buttonVariants({
                    size: 'icon-sm',
                    variant: 'quiet',
                  })}
                  conversationId={conversationId}
                />
              </>
            )}
          </div>
        </header>
        <div className='px-4 pb-4'>
          {showCode && <PreviewCode>{artifact.html}</PreviewCode>}
          <div hidden={showCode}>
            {html !== undefined && (
              <SandboxFrame
                arriving={arrival && develop}
                from={arrival ? PREVIEW_HEIGHT : undefined}
                glide={glide}
                html={html}
                onCall={onCall}
                onError={onError}
                onSend={addToDraft}
                title={title}
              />
            )}
          </div>
        </div>
        {errors.length > 0 && (
          <Errors
            errors={errors}
            onFix={() => addToDraft(fixRequest(title, errors))}
          />
        )}
        {fullScreen && (
          <FullScreen
            artifact={artifact}
            onCall={onCall}
            onClose={() => setFullScreen(false)}
            status={status}
          />
        )}
      </Card>
    </section>
  );
}

function artifactCard(name: string) {
  return (view: ToolView) => {
    if (view.active) {
      const title = text(field(view.args, 'title')) ?? 'an artifact';

      return (
        <Building
          callId={view.callId}
          html={text(field(view.args, 'content')) ?? ''}
          id={text(field(view.args, 'id'))}
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
      <Live artifact={artifact} callId={view.callId} />
    );
  };
}

const artifactTitle = namedTitle(
  ({ args, details }) =>
    text(field(details, 'title')) ?? text(field(args, 'title')),
  { unnamed: 'an artifact' }
);

export const artifactRenderers = {
  artifact_create: {
    icon: LayoutTemplate,
    inline: artifactCard('artifact_create'),
    title: artifactTitle('Building an artifact', 'Built'),
    yields: 'file',
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
  artifact_state_read: {
    icon: LayoutTemplate,
    preview: ({ details }) => {
      const title = text(field(details, 'title'));

      return title ? (
        <PreviewList
          items={[
            {
              key: title,
              label: title,
              meta: plural(count(field(details, 'keys')) ?? 0, 'saved value'),
            },
          ]}
        />
      ) : undefined;
    },
    title: artifactTitle('Reading saved data', 'Read saved data from'),
  },
  artifact_update: {
    icon: LayoutTemplate,
    inline: artifactCard('artifact_update'),
    title: artifactTitle('Updating an artifact', 'Updated'),
  },
} satisfies Record<string, ToolRenderer>;
