import { useEffect } from 'react';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} – Lab`;

    return () => {
      document.title = 'Lab';
    };
  }, [title]);
}
