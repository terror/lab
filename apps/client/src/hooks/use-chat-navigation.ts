import { useCallback, useEffect, useState } from 'react';

function readLocation() {
  const params = new URLSearchParams(location.search);

  return {
    workspaceId: params.get('workspace'),
    sessionId: params.get('session'),
  };
}

export function useChatNavigation() {
  const [selection, setSelection] = useState(readLocation);

  useEffect(() => {
    const update = () => setSelection(readLocation());

    window.addEventListener('popstate', update);

    return () => window.removeEventListener('popstate', update);
  }, []);

  const navigate = useCallback(
    (workspaceId: string, sessionId: string | null = null) => {
      const url = new URL(location.href);
      url.search = '';
      url.searchParams.set('workspace', workspaceId);

      if (sessionId) {
        url.searchParams.set('session', sessionId);
      }

      history.pushState(null, '', url);
      setSelection({ workspaceId, sessionId });
    },
    []
  );

  return { ...selection, navigate };
}
