import { focusManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

export function refetchOnForeground() {
  focusManager.setEventListener((onFocus) => {
    const subscription = AppState.addEventListener('change', (status) =>
      onFocus(status === 'active')
    );

    return () => subscription.remove();
  });
}
