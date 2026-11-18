import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { StatusIcon } from './status-icon';

const meta = preview.meta({
  component: StatusIcon,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'The one set of step states for tool steps, plan steps, subagent lanes, and script calls. A running step gets the live Dot. Done is a check, failed is a cross in the destructive color, and stopped is a ban. Pair each with words, since the icon is hidden from screen readers.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Status icon',
});

const rows = [
  { label: 'Reading reviews', status: 'running' },
  { label: 'Searched the web', status: 'done' },
  { label: 'Couldn’t read a page', status: 'failed' },
  { label: 'Stopped', status: 'stopped' },
] as const;

export const States = meta.story({
  render: () => (
    <ul className='flex flex-col gap-2 text-sm text-muted-foreground'>
      {rows.map(({ label, status }) => (
        <li key={status} className='flex items-center gap-2'>
          <span className='flex size-4 items-center justify-center'>
            <StatusIcon status={status} />
          </span>
          {label}
        </li>
      ))}
    </ul>
  ),
});
