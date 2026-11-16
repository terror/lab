import { Search } from 'lucide-react';

import preview from '../../../.storybook/preview';
import { Button } from './button';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

const meta = preview.meta({
  component: Tooltip,
  tags: ['autodocs'],
  title: 'Components/Tooltip',
});

export const Default = meta.story({
  render: () => (
    <Tooltip defaultOpen>
      <TooltipTrigger asChild>
        <Button aria-label='Search' size='icon' variant='ghost'>
          <Search aria-hidden='true' />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Search (⌘K)</TooltipContent>
    </Tooltip>
  ),
});
