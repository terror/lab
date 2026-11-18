import { createCn } from 'cn/config';

export const cn = createCn({
  extend: {
    classGroups: {
      duration: [{ duration: ['base', 'fast', 'slow', 'story'] }],
    },
    theme: {
      radius: ['card', 'control', 'dialog', 'menu'],
    },
  },
});
