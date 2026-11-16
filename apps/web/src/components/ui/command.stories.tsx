import { MessageSquare, Settings, SquarePen } from 'lucide-react';

import preview from '../../../.storybook/preview';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';

const meta = preview.meta({
  component: Command,
  tags: ['autodocs'],
  title: 'Components/Command',
});

export const Search = meta.story({
  render: () => (
    <Command className='w-80 rounded-xl shadow-md ring-1 ring-foreground/10'>
      <CommandInput placeholder='Search...' />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading='Actions'>
          <CommandItem>
            <SquarePen aria-hidden='true' />
            New chat
          </CommandItem>
          <CommandItem>
            <Settings aria-hidden='true' />
            Settings
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading='Chats'>
          <CommandItem>
            <MessageSquare aria-hidden='true' />
            Quiet temples in Kyoto
          </CommandItem>
          <CommandItem>
            <MessageSquare aria-hidden='true' />
            Sourdough starter schedule
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
});
