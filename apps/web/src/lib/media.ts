import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);

      media.addEventListener('change', onChange);

      return () => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches
  );
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);

  return () => document.removeEventListener('visibilitychange', onChange);
}

export function usePageHidden() {
  return useSyncExternalStore(subscribeVisibility, () => document.hidden);
}

export function usePhone() {
  return useMediaQuery('(pointer: coarse) and (max-width: 767px)');
}
