import type { ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const remarkPlugins = [remarkGfm];

function Link({ href, children }: ComponentProps<'a'>) {
  return (
    <a href={href} rel='noreferrer' target='_blank'>
      {children}
    </a>
  );
}

const components = { a: Link };

export function Markdown({ children }: { children: string }) {
  return (
    <div className='prose max-w-none prose-neutral dark:prose-invert prose-pre:bg-muted prose-pre:text-foreground'>
      <ReactMarkdown components={components} remarkPlugins={remarkPlugins}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
