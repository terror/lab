import { useSyncExternalStore } from 'react';

type Route =
  | { kind: 'conversation'; id: number }
  | { kind: 'new' }
  | { kind: 'settings' };

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);

  return () => window.removeEventListener('popstate', onChange);
}

function pathname() {
  return window.location.pathname;
}

function parse(path: string): Route {
  if (path === '/settings') {
    return { kind: 'settings' };
  }

  const id = /^\/c\/(\d+)$/.exec(path)?.[1];

  if (id !== undefined) {
    return { kind: 'conversation', id: Number(id) };
  }

  return { kind: 'new' };
}

export function useRoute() {
  return parse(useSyncExternalStore(subscribe, pathname));
}

function navigate(path: string) {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

let returnTo = '/';

export function selectConversation(id: number) {
  navigate(`/c/${id}`);
}

export function openNewChat() {
  navigate('/');
}

export function openSettings() {
  returnTo = window.location.pathname;
  navigate('/settings');
}

export function closeSettings() {
  navigate(returnTo);
}
