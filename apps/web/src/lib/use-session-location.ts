import { useSyncExternalStore } from 'react';

function currentSession() {
  return new URL(window.location.href).searchParams.get('session');
}

export function subscribeSessionNavigation(navigate: () => void) {
  window.addEventListener('popstate', navigate);

  window.addEventListener('lab:navigate', navigate);

  return () => {
    window.removeEventListener('popstate', navigate);

    window.removeEventListener('lab:navigate', navigate);
  };
}

function openSession(sessionId: string) {
  const url = new URL(window.location.href);

  if (url.searchParams.get('session') === sessionId) {
    return;
  }

  url.searchParams.set('session', sessionId);

  window.history.pushState(null, '', url);

  window.dispatchEvent(new Event('lab:navigate'));
}

export function useSessionLocation() {
  const sessionId = useSyncExternalStore(
    subscribeSessionNavigation,
    currentSession
  );

  return { sessionId, openSession };
}
