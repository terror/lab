import { LogOut, Settings } from 'lucide-react';

import preview from '../../../.storybook/preview';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';

const meta = preview.meta({
  component: DropdownMenu,
  parameters: {
    a11y: { config: { rules: [{ enabled: false, id: 'aria-hidden-focus' }] } },
  },
  tags: ['autodocs'],
  title: 'Components/Dropdown menu',
});

export const Actions = meta.story({
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant='outline'>Account</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-48'>
        <DropdownMenuItem>
          <Settings aria-hidden='true' />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LogOut aria-hidden='true' />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
});

export const Choice = meta.story({
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant='outline'>Sort</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-48'>
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup value='activity'>
          <DropdownMenuRadioItem value='activity'>
            Recent activity
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value='created'>
            Date created
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value='title'>Title</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
});
