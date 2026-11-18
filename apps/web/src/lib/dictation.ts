import { useEffect, useRef, useState } from 'react';

type Recognition = {
  abort: () => void;
  addEventListener: {
    (type: 'end', listener: () => void): void;
    (
      type: 'error',
      listener: (event: SpeechRecognitionErrorEvent) => void
    ): void;
    (type: 'result', listener: (event: SpeechRecognitionEvent) => void): void;
  };
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
};

type RecognitionConstructor = new () => Recognition;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

type DictationState =
  | { kind: 'failed'; message: string }
  | { kind: 'idle' }
  | { kind: 'listening' };

const idle: DictationState = { kind: 'idle' };

const quiet = new Set<string>(['aborted', 'no-speech']);

const failures: Record<string, string> = {
  'audio-capture': 'No microphone was found',
  network: 'Dictation needs an internet connection',
  'not-allowed': 'Allow microphone access to dictate',
  'service-not-allowed': 'Allow microphone access to dictate',
};

function recognizer() {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

function transcript(results: SpeechRecognitionResultList) {
  return Array.from(results, (result) => result[0]?.transcript ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function useDictation({
  draft,
  onDraftChange,
}: {
  draft: string;
  onDraftChange: (draft: string) => void;
}) {
  const [state, setState] = useState(idle);
  const recognition = useRef<Recognition>(undefined);

  useEffect(() => () => recognition.current?.abort(), []);

  const start = () => {
    const Recognizer = recognizer();

    if (!Recognizer) {
      return;
    }

    const base = draft.trimEnd();

    const prefix = base ? `${base} ` : '';

    const current = new Recognizer();

    current.continuous = true;
    current.interimResults = true;
    current.lang = navigator.language;

    current.addEventListener('result', (event) => {
      const text = transcript(event.results);

      if (text) {
        onDraftChange(`${prefix}${text}`);
      }
    });

    current.addEventListener('error', (event) => {
      if (!quiet.has(event.error)) {
        setState({
          kind: 'failed',
          message: failures[event.error] ?? 'Dictation stopped unexpectedly',
        });
      }
    });

    current.addEventListener('end', () => {
      recognition.current = undefined;
      setState((now) => (now.kind === 'listening' ? idle : now));
    });

    recognition.current = current;
    setState({ kind: 'listening' });
    current.start();
  };

  const stop = () => recognition.current?.stop();

  const cancel = () => recognition.current?.abort();

  return {
    cancel,
    start,
    state,
    stop,
    supported: recognizer() !== undefined,
  };
}
