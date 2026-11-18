import { useLayoutEffect, useRef, useState } from 'react';

const LIMIT = 6;

let claimed = 0;

function claim() {
  if (claimed === 0) {
    setTimeout(() => {
      claimed = 0;
    });
  }

  claimed += 1;

  return claimed - 1;
}

export function useHandoff(activity: string) {
  const previous = useRef(activity);
  const [order, setOrder] = useState<number>();

  useLayoutEffect(() => {
    const finished = previous.current === 'running' && activity === 'unread';

    previous.current = activity;

    const place = finished ? claim() : LIMIT;

    setOrder(place < LIMIT ? place : undefined);
  }, [activity]);

  return [order, () => setOrder(undefined)] as const;
}
