import { useLayoutEffect, useRef } from 'react';

import { useMoment } from './moment';

export function useHandoff(activity: string) {
  const handoff = useMoment('row.handoff');
  const previous = useRef(activity);
  const { play } = handoff;

  useLayoutEffect(() => {
    const finished = previous.current === 'running' && activity === 'unread';

    previous.current = activity;

    if (finished) {
      play();
    }
  }, [activity, play]);

  return handoff;
}
