import { type SettingsSection } from '@/lib/settings';
import { Link, useNavigate } from '@tanstack/react-router';

import { type ToolView } from './types';

const PREVIEW_ITEMS = 5;

export function Label({ children }: { children: string }) {
  return <span className='text-xs text-muted-foreground'>{children}</span>;
}

export type PreviewItem = {
  chatId?: number;
  href?: string;
  projectId?: number;
  key: string;
  label: string;
  meta?: string;
};

export const linkClass =
  'group flex min-w-0 flex-1 items-baseline justify-between gap-4 outline-none focus-visible:underline';

export function PreviewRow({
  chatId,
  href,
  label,
  meta,
  projectId,
}: PreviewItem) {
  const content = (
    <>
      <span className='min-w-0 truncate text-foreground/90 underline-offset-4 group-hover:underline'>
        {label}
      </span>
      {meta && (
        <span className='shrink-0 text-xs text-muted-foreground tabular-nums'>
          {meta}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <a className={linkClass} href={href} rel='noreferrer' target='_blank'>
        {content}
      </a>
    );
  }

  if (projectId !== undefined) {
    return (
      <Link
        className={linkClass}
        params={{ projectId: String(projectId) }}
        to='/projects/$projectId'
      >
        {content}
      </Link>
    );
  }

  if (chatId === undefined) {
    return content;
  }

  return (
    <Link className={linkClass} params={{ id: chatId }} to='/c/$id'>
      {content}
    </Link>
  );
}

export function PreviewList({ items }: { items: readonly PreviewItem[] }) {
  const shown = items.slice(0, PREVIEW_ITEMS);

  const rest = items.length - shown.length;

  return (
    <ul className='flex flex-col'>
      {shown.map((item) => (
        <li
          key={item.key}
          className='flex items-baseline justify-between gap-4 py-1 text-sm'
        >
          <PreviewRow {...item} />
        </li>
      ))}
      {rest > 0 && (
        <li className='py-1 text-xs text-muted-foreground'>{rest} more</li>
      )}
    </ul>
  );
}

export function PreviewPassage({ children }: { children: string }) {
  return (
    <p className='line-clamp-6 text-sm/relaxed whitespace-pre-wrap text-foreground/80'>
      {children}
    </p>
  );
}

export function PreviewCode({ children }: { children: string }) {
  return (
    <pre className='max-h-64 overflow-auto rounded-xl bg-muted/40 px-3.5 py-3 font-mono text-xs/relaxed whitespace-pre-wrap text-foreground/80'>
      {children}
    </pre>
  );
}

export function Block({
  children,
  label,
}: {
  children: string;
  label: string;
}) {
  return (
    <div className='flex flex-col gap-1.5'>
      <Label>{label}</Label>
      <PreviewCode>{children}</PreviewCode>
    </div>
  );
}

export function Raw({ args, output }: ToolView) {
  const shown = Object.keys(args).length > 0;

  return (
    <>
      {shown && (
        <Block label='Arguments'>{JSON.stringify(args, null, 2)}</Block>
      )}
      <Block label='Output'>{output || 'No output'}</Block>
    </>
  );
}

export function FooterButton({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      className='text-xs text-muted-foreground transition-colors hover:text-foreground'
      onClick={onClick}
      type='button'
    >
      {children}
    </button>
  );
}

export function SettingsLink({
  children,
  section,
}: {
  children: string;
  section: SettingsSection;
}) {
  const navigate = useNavigate();

  return (
    <FooterButton
      onClick={() => {
        void navigate({ search: { section }, to: '/settings' });
      }}
    >
      {children}
    </FooterButton>
  );
}
