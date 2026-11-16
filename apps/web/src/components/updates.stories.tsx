import { fn } from 'storybook/test';

import preview from '../../.storybook/preview';
import { Changelog } from './updates';

const meta = preview.meta({
  component: Changelog,
  tags: ['autodocs'],
  title: 'Patterns/Changelog',
});

export const Default = meta.story({
  args: {
    entries: [
      {
        date: '2026-11-16T18:00:00Z',
        sha: 'aaa',
        title: 'Add a Usage settings page',
        url: 'https://github.com/terror/lab/pull/134',
      },
      {
        date: '2026-11-16T17:00:00Z',
        sha: 'bbb',
        title: 'Connect providers from a dialog',
        url: 'https://github.com/terror/lab/pull/132',
      },
    ],
    onClose: fn(),
  },
});
