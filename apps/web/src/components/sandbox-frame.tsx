import { useDark } from '@/lib/theme';
import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';

const MIN_HEIGHT = 48;

const MAX_HEIGHT = 10_000;

const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready') }),
  z.object({ height: z.number(), type: z.literal('size') }),
  z.object({ message: z.string().max(500), type: z.literal('error') }),
  z.object({ text: z.string().max(2_000), type: z.literal('send') }),
  z.object({
    active: z.boolean(),
    args: z.unknown(),
    id: z.number(),
    method: z.string().max(100),
    type: z.literal('call'),
  }),
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

function themed(html: string, dark: boolean) {
  const style = getComputedStyle(document.documentElement);

  const variables = THEME_VARIABLES.map(
    (name) => `${name}:${style.getPropertyValue(name).trim()}`
  ).join(';');

  return `<style>:root{${variables};color-scheme:${dark ? 'dark' : 'light'}}body{margin:0;background:transparent;color:var(--foreground);font-family:system-ui,sans-serif}</style>${html}`;
}

export type FrameCall = (
  method: string,
  args: unknown,
  active: boolean
) => Promise<unknown>;

async function answer(
  { active, args, method }: { active: boolean; args: unknown; method: string },
  onCall?: FrameCall
) {
  try {
    if (!onCall) {
      throw new Error(`lab.${method} isn’t available here.`);
    }

    return { value: await onCall(method, args, active) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export function SandboxFrame({
  height: fixed,
  html,
  onCall,
  onError,
  onSend,
  scripts = true,
  title,
}: {
  height?: number;
  html: string;
  onCall?: FrameCall;
  onError?: (message: string) => void;
  onSend?: (text: string) => void;
  scripts?: boolean;
  title: string;
}) {
  const dark = useDark();
  const content = useMemo(() => themed(html, dark), [dark, html]);

  const frame = useRef<HTMLIFrameElement>(null);
  const port = useRef<MessagePort>(undefined);
  const latest = useRef(content);
  const report = useRef(onError);
  const sendText = useRef(onSend);
  const handle = useRef(onCall);

  const [height, setHeight] = useState(MIN_HEIGHT);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    handle.current = onCall;
    report.current = onError;
    sendText.current = onSend;
  }, [onCall, onError, onSend]);

  useEffect(() => {
    latest.current = content;
    port.current?.postMessage({
      html: content,
      scripts,
      title,
      type: 'render',
    });
  }, [content, scripts, title]);

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
          html: latest.current,
          scripts,
          title,
          type: 'render',
        });
      }

      if (message?.type === 'size') {
        setHeight(Math.min(Math.max(message.height, MIN_HEIGHT), MAX_HEIGHT));
      }

      if (message?.type === 'error') {
        report.current?.(message.message);
      }

      if (message?.type === 'send' && navigator.userActivation.isActive) {
        sendText.current?.(message.text);
      }

      if (message?.type === 'call') {
        void answer(message, handle.current).then((reply) =>
          channel.port1.postMessage({
            ...reply,
            id: message.id,
            type: 'reply',
          })
        );
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
        colorScheme: dark ? 'dark' : 'light',
        height: fixed ?? height,
      }}
      title={title}
    />
  );
}
