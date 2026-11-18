import { usePreference } from './preferences';

export function useQuiet() {
  const [personality] = usePreference('personality');

  return personality === 'quiet';
}
