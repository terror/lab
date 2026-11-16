import { useRouterState } from '@tanstack/react-router';

export function usePath() {
  return useRouterState({ select: ({ location }) => location.pathname });
}
