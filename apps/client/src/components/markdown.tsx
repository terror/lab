import { CopyButton } from '@/components/copy-button';
import { type ReactNode, isValidElement, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function textContent(children: ReactNode): string {
  if (typeof children === 'string') {
    return children;
  }

  if (Array.isArray(children)) {
    return children.map(textContent).join('');
  }

  if (isValidElement<{ children?: ReactNode }>(children)) {
    return textContent(children.props.children);
  }

  return '';
}

export const Markdown = memo(function Markdown({
  children,
}: {
  children: string;
}) {
  return (
    <div className='markdown min-w-0'>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a href={href} target='_blank' rel='noopener noreferrer'>
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <a href={src} target='_blank' rel='noopener noreferrer'>
              {alt || 'View image'}
            </a>
          ),
          pre: ({ children }) => {
            const language = isValidElement<{ className?: string }>(children)
              ? children.props.className?.replace('language-', '')
              : undefined;

            return (
              <div className='code-block'>
                <div className='flex items-center justify-between border-b px-4 py-1.5 text-xs text-muted-foreground'>
                  <span>{language || 'Code'}</span>
                  <CopyButton text={textContent(children)} label='Copy code' />
                </div>
                <pre>{children}</pre>
              </div>
            );
          },
          table: ({ children }) => (
            <div className='overflow-x-auto'>
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
