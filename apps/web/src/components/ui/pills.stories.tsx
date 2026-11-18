import { useState } from 'react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Pills } from './pills';

const meta = preview.meta({
  component: Pills,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'The one control for picking one of a few: list filters, ranges, and scopes. Use it for up to five short options. Pass a count to show how many items each option holds.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Pills',
});

function Demo({
  options,
}: {
  options: { count?: number; label: string; value: string }[];
}) {
  const [value, setValue] = useState('all');

  return (
    <Pills
      label='Filter'
      onValueChange={setValue}
      options={options}
      value={value}
    />
  );
}

export const Filter = meta.story({
  render: () => (
    <Demo
      options={[
        { label: 'All', value: 'all' },
        { label: 'Images', value: 'image' },
        { label: 'Files', value: 'file' },
      ]}
    />
  ),
});

export const WithCounts = meta.story({
  render: () => (
    <Demo
      options={[
        { count: 12, label: 'All', value: 'all' },
        { count: 9, label: 'Chats', value: 'chats' },
        { count: 3, label: 'Projects', value: 'projects' },
      ]}
    />
  ),
});
