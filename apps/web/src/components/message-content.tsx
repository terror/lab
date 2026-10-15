import { ExternalLink } from "lucide-react";
import { createContext, memo, useContext, useId } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopyButton } from "@/components/copy-button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const LinkContext = createContext(false);

const components = {
  a: ({ children, href, node: _node, ...props }) =>
    href ? (
      <LinkContext value={true}>
        <a
          {...props}
          href={href}
          rel={href.startsWith("#") ? undefined : "noopener noreferrer"}
          target={href.startsWith("#") ? undefined : "_blank"}
        >
          {children}
        </a>
      </LinkContext>
    ) : (
      <span>{children}</span>
    ),
  code: ({ children, className }) => (
    <code
      className={cn(
        "rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.875em]",
        className,
      )}
    >
      {children}
    </code>
  ),
  img: function MarkdownImage({ alt, src, title }) {
    const linked = useContext(LinkContext);

    return typeof src === "string" && src && !linked ? (
      <a
        className="inline-flex items-center gap-1.5"
        href={src}
        rel="noopener noreferrer"
        target="_blank"
        title={title}
      >
        {alt || "View image"}
        <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
      </a>
    ) : (
      <span>{alt || "Image"}</span>
    );
  },
  pre: ({ children, node }) => {
    const code = node?.children.find(
      (child) => child.type === "element" && child.tagName === "code",
    );
    const text =
      code?.type === "element"
        ? code.children
            .flatMap((child) => (child.type === "text" ? [child.value] : []))
            .join("")
        : "";
    const language =
      code?.type === "element" && Array.isArray(code.properties.className)
        ? code.properties.className
            .find(
              (value) =>
                typeof value === "string" && value.startsWith("language-"),
            )
            ?.toString()
            .slice(9)
        : undefined;

    return (
      <div className="my-5 min-w-0 overflow-hidden rounded-2xl border bg-muted/35">
        <div className="flex min-h-10 items-center justify-between gap-3 border-b px-4 py-1">
          <span className="truncate font-mono text-xs text-muted-foreground">
            {language || "Code"}
          </span>
          <CopyButton label="Copy code" text={text} />
        </div>
        <ScrollArea
          viewportProps={{
            "aria-label": language ? `${language} code` : "Code",
            className: "max-h-[32rem]",
            role: "region",
            tabIndex: 0,
          }}
        >
          <pre className="w-max min-w-full p-4 text-[13px] leading-6 [&_code]:block [&_code]:rounded-none [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit">
            {children}
          </pre>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    );
  },
  table: ({ children }) => (
    <ScrollArea
      className="my-5 max-w-full rounded-xl border"
      viewportProps={{
        "aria-label": "Table",
        role: "region",
        tabIndex: 0,
      }}
    >
      <table className="w-full border-collapse text-left text-sm">
        {children}
      </table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  ),
} satisfies Components;

const plugins = [remarkGfm];

export const MessageContent = memo(function MessageContent({
  text,
}: {
  text: string;
}) {
  const id = useId();

  return (
    <div
      className={cn(
        "min-w-0 text-base leading-7 break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "[&_p]:my-4 [&_h1]:mt-7 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight",
        "[&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight",
        "[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:mt-4 [&_h4]:font-semibold",
        "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_li>p]:my-2 [&_li>ul]:my-2 [&_li>ol]:my-2",
        "[&_blockquote]:my-5 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_hr]:my-7 [&_strong]:font-semibold",
        "[&_a]:rounded-sm [&_a]:font-medium [&_a]:underline [&_a]:decoration-foreground/35 [&_a]:underline-offset-4 [&_a:hover]:decoration-foreground [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-ring",
        "[&_th]:border-b [&_th]:bg-muted/60 [&_th]:px-4 [&_th]:py-2.5 [&_th]:font-medium [&_td]:border-b [&_td]:px-4 [&_td]:py-2.5 [&_tr:last-child_td]:border-b-0",
        "[&_.contains-task-list]:list-none [&_.contains-task-list]:pl-1 [&_input[type=checkbox]]:mr-2 [&_input[type=checkbox]]:accent-primary [&_.footnotes]:mt-7 [&_.footnotes]:text-sm [&_.footnotes]:text-muted-foreground",
      )}
    >
      <Markdown
        components={components}
        remarkPlugins={plugins}
        remarkRehypeOptions={{ clobberPrefix: `${id}-` }}
      >
        {text}
      </Markdown>
    </div>
  );
});
