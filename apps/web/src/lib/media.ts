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

export function usePhone() {
  return useMediaQuery('(pointer: coarse) and (max-width: 767px)');
}
