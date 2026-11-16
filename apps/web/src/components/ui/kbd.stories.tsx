import preview from '../../../.storybook/preview';
import { Kbd, KbdGroup } from './kbd';

const meta = preview.meta({
  component: Kbd,
  tags: ['autodocs'],
  title: 'Components/Kbd',
});

export const Shortcuts = meta.story({
  render: () => (
    <div className='flex flex-col gap-3 text-sm text-muted-foreground'>
      <span className='flex items-center gap-2'>
        Search <Kbd>⌘K</Kbd>
      </span>
      <span className='flex items-center gap-2'>
        Steer the current answer
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd>
        </KbdGroup>
      </span>
    </div>
  ),
});
