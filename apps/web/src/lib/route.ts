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

function navigate(path: string) {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function selectConversation(id: number) {
  navigate(`/c/${id}`);
}

export function openNewChat() {
  navigate('/');
}
