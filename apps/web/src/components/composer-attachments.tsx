import { DocumentThumbnail } from '@/components/document-card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ListRow } from '@/components/ui/list-row';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  type Attachment,
  imageSource,
  readAttachment,
  readLibraryItem,
  textLimit,
} from '@/lib/attachments';
import type { LibraryItem } from '@/lib/library';
import { usePhone } from '@/lib/media';
import { type ModelChoice, modelsQueryOptions } from '@/lib/models';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  LibraryBig,
  type LucideIcon,
  Paperclip,
  Plus,
  X,
} from 'lucide-react';
import {
  lazy,
  Suspense,
  useRef,
  useState,
  type ClipboardEvent,
  type Dispatch,
  type SetStateAction,
} from 'react';

const LibraryPicker = lazy(async () => ({
  default: (await import('@/components/library-picker')).LibraryPicker,
}));

const MAX_ATTACHMENTS = 8;

export function useAttachmentIntake({
  attachments,
  model,
  onAttachmentsChange,
  onError,
}: {
  attachments: Attachment[];
  model: ModelChoice | undefined;
  onAttachmentsChange: Dispatch<SetStateAction<Attachment[]>>;
  onError: (message: string | undefined) => void;
}) {
  const catalog = useQuery(modelsQueryOptions).data?.models;

  const limit = textLimit(
    catalog?.find(
      ({ id, provider }) => id === model?.id && provider === model.provider
    )
  );

  const room = MAX_ATTACHMENTS - attachments.length;

  const attach = async <T,>(
    sources: T[],
    read: (source: T) => Promise<Attachment>
  ) => {
    onError(undefined);

    const results = await Promise.allSettled(sources.slice(0, room).map(read));

    const added = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : []
    );

    const failed = results.find((result) => result.status === 'rejected');

    if (failed) {
      onError(
        String(
          failed.reason instanceof Error ? failed.reason.message : failed.reason
        )
      );
    }

    if (sources.length > room) {
      onError(`You can attach up to ${MAX_ATTACHMENTS} files`);
    }

    onAttachmentsChange((current) =>
      [...current, ...added].slice(0, MAX_ATTACHMENTS)
    );
  };

  const addFiles = (files: File[]) =>
    attach(files, (file) => readAttachment(file, limit));

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...event.clipboardData.files];

    if (files.length > 0) {
      event.preventDefault();
      void addFiles(files);
    }
  };

  return {
    addFiles,
    addItems: (items: LibraryItem[]) =>
      attach(items, (item) => readLibraryItem(item, limit)),
    attached: new Set(
      attachments.flatMap(({ libraryId }) =>
        libraryId === undefined ? [] : [libraryId]
      )
    ),
    onPaste,
    room,
  };
}

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  return (
    <div className='group relative'>
      {attachment.type === 'image' && (
        <img
          alt={attachment.name}
          className='size-16 rounded-xl border object-cover'
          src={imageSource(attachment)}
        />
      )}
      {attachment.type === 'file' && attachment.uploadId && (
        <div className='flex h-16 max-w-56 items-center gap-3 overflow-hidden rounded-xl border pr-3 text-sm'>
          <DocumentThumbnail
            className='flex h-full w-12 shrink-0 items-center justify-center border-r bg-white object-cover object-top'
            uploadId={attachment.uploadId}
          />
          <span className='truncate'>{attachment.name}</span>
        </div>
      )}
      {attachment.type === 'file' && !attachment.uploadId && (
        <div className='flex h-16 max-w-48 items-center gap-2 rounded-xl border px-3 text-sm'>
          <FileText aria-hidden='true' className='size-4 shrink-0' />
          <span className='truncate'>{attachment.name}</span>
        </div>
      )}
      <Button
        aria-label={`Remove ${attachment.name}`}
        className='absolute -top-2 -right-2 rounded-full shadow-xs'
        onClick={onRemove}
        size='icon-xs'
        type='button'
        variant='secondary'
      >
        <X aria-hidden='true' />
      </Button>
    </div>
  );
}

export function AttachmentPreviews({
  attachments,
  onAttachmentsChange,
}: {
  attachments: Attachment[];
  onAttachmentsChange: Dispatch<SetStateAction<Attachment[]>>;
}) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className='flex flex-wrap gap-2 px-4 pt-4'>
      {attachments.map((attachment, index) => (
        <AttachmentPreview
          key={`${attachment.name}-${index}`}
          attachment={attachment}
          onRemove={() =>
            onAttachmentsChange(
              attachments.filter((_, other) => other !== index)
            )
          }
        />
      ))}
    </div>
  );
}

type Source = { icon: LucideIcon; label: string; run: () => void };

function SourceMenu({
  disabled,
  onCloseAutoFocus,
  sources,
}: {
  disabled: boolean;
  onCloseAutoFocus: (event: Event) => void;
  sources: Source[];
}) {
  const phone = usePhone();
  const [open, setOpen] = useState(false);

  const trigger = (
    <Button
      aria-label='Add photos and files'
      className='rounded-full'
      disabled={disabled}
      size='icon'
      type='button'
      variant='quiet'
    >
      <Plus aria-hidden='true' />
    </Button>
  );

  if (!phone) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent
          align='start'
          onCloseAutoFocus={onCloseAutoFocus}
          side='top'
        >
          {sources.map(({ icon: Icon, label, run }) => (
            <DropdownMenuItem key={label} onSelect={run}>
              <Icon aria-hidden='true' />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        className='gap-0 rounded-t-dialog'
        onCloseAutoFocus={onCloseAutoFocus}
        showCloseButton={false}
        side='bottom'
      >
        <SheetHeader className='pb-2'>
          <SheetTitle>Add to your message</SheetTitle>
          <SheetDescription className='sr-only'>
            Attach photos and files
          </SheetDescription>
        </SheetHeader>
        <ul className='px-4 pb-4'>
          {sources.map(({ icon: Icon, label, run }) => (
            <ListRow key={label} asChild>
              <button
                onClick={() => {
                  setOpen(false);
                  run();
                }}
                type='button'
              >
                <Icon
                  aria-hidden='true'
                  className='size-4 text-muted-foreground'
                />
                {label}
              </button>
            </ListRow>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

export function AttachMenu({
  disabled,
  intake,
}: {
  disabled: boolean | undefined;
  intake: ReturnType<typeof useAttachmentIntake>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState(false);
  const [pickerOpened, setPickerOpened] = useState(false);
  const openingPicker = useRef(false);

  const openPicker = () => {
    openingPicker.current = true;
    setPickerOpened(true);
    setPicking(true);
  };

  const addFromLibrary = async (items: LibraryItem[]) => {
    await intake.addItems(items);
    setPicking(false);
  };

  return (
    <>
      <input
        className='hidden'
        multiple
        onChange={(event) => {
          void intake.addFiles([...(event.target.files ?? [])]);
          event.target.value = '';
        }}
        ref={input}
        type='file'
      />
      <SourceMenu
        disabled={disabled || intake.room <= 0}
        onCloseAutoFocus={(event) => {
          if (openingPicker.current) {
            openingPicker.current = false;
            event.preventDefault();
          }
        }}
        sources={[
          {
            icon: Paperclip,
            label: 'Add photos & files',
            run: () => input.current?.click(),
          },
          { icon: LibraryBig, label: 'Add from library', run: openPicker },
        ]}
      />
      {pickerOpened && (
        <Suspense fallback={null}>
          <LibraryPicker
            attached={intake.attached}
            limit={intake.room}
            onAdd={addFromLibrary}
            onOpenChange={setPicking}
            open={picking}
          />
        </Suspense>
      )}
    </>
  );
}
