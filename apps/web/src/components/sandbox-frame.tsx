import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';

const MIN_HEIGHT = 48;

const MAX_HEIGHT = 10_000;

const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready') }),
  z.object({ height: z.number(), type: z.literal('size') }),
  z.object({ message: z.string().max(500), type: z.literal('error') }),
]);

const FRAME_SANDBOX = 'allow-scripts allow-forms';

const THEME_VARIABLES = [
  '--background',
  '--border',
  '--foreground',
  '--muted',
  '--muted-foreground',
  '--primary',
  '--primary-foreground',
];

function dark() {
  return document.documentElement.classList.contains('dark');
}

function themed(html: string) {
  const style = getComputedStyle(document.documentElement);

  const variables = THEME_VARIABLES.map(
    (name) => `${name}:${style.getPropertyValue(name).trim()}`
  ).join(';');

  return `<style>:root{${variables};color-scheme:${dark() ? 'dark' : 'light'}}body{margin:0;background:transparent;color:var(--foreground);font-family:system-ui,sans-serif}</style>${html}`;
}

export function SandboxFrame({
  height: fixed,
  html,
  onError,
  scripts = true,
  title,
}: {
  height?: number;
  html: string;
  onError?: (message: string) => void;
  scripts?: boolean;
  title: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const port = useRef<MessagePort>(undefined);
  const latest = useRef(html);
  const report = useRef(onError);

  const [height, setHeight] = useState(MIN_HEIGHT);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    report.current = onError;
  }, [onError]);

  useEffect(() => {
    latest.current = html;
    port.current?.postMessage({ html: themed(html), scripts, type: 'render' });
  }, [html, scripts]);

  useEffect(() => () => port.current?.close(), []);

  const connect = () => {
    const target = frame.current?.contentWindow;

    if (port.current) {
      port.current.close();
      setClosed(true);
      return;
    }

    if (!target) {
      return;
    }

    const channel = new MessageChannel();

    channel.port1.addEventListener('message', ({ data }) => {
      const message = messageSchema.safeParse(data).data;

      if (message?.type === 'ready') {
        channel.port1.postMessage({
          html: themed(latest.current),
          scripts,
          type: 'render',
        });
      }

      if (message?.type === 'size') {
        setHeight(Math.min(Math.max(message.height, MIN_HEIGHT), MAX_HEIGHT));
      }

      if (message?.type === 'error') {
        report.current?.(message.message);
      }
    });

    channel.port1.start();

    port.current = channel.port1;

    target.postMessage({ type: 'lab:connect' }, '*', [channel.port2]);
  };

  if (closed) {
    return (
      <p className='text-sm text-muted-foreground'>
        This preview tried to leave its frame and was closed.
      </p>
    );
  }

  return (
    <iframe
      allow=''
      className='block w-full border-0 bg-transparent'
      onLoad={connect}
      ref={frame}
      referrerPolicy='no-referrer'
      sandbox={FRAME_SANDBOX}
      src='/frame'
      style={{
        colorScheme: dark() ? 'dark' : 'light',
        height: fixed ?? height,
      }}
      title={title}
    />
  );
}
