import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);

  return () => window.removeEventListener('popstate', onChange);
}

function selected() {
  const id = /^\/c\/(\d+)$/.exec(window.location.pathname)?.[1];

  return id === undefined ? undefined : Number(id);
}

export function useSelectedConversation() {
  return useSyncExternalStore(subscribe, selected);
}

export function selectConversation(id: number) {
  window.history.pushState(null, '', `/c/${id}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
