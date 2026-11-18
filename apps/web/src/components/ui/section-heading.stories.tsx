import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Button } from './button';
import { SectionHeading } from './section-heading';

const meta = preview.meta({
  component: SectionHeading,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'The heading above a list or a group of settings. Its text lines up with ListRow text. Use actions for a filter or a button.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Section heading',
});

export const Default = meta.story({
  args: { children: 'Tasks' },
  render: (args) => (
    <div className='w-72'>
      <SectionHeading {...args} />
    </div>
  ),
});

export const WithActions = meta.story({
  args: {
    actions: (
      <Button size='sm' variant='outline'>
        Active
      </Button>
    ),
    children: 'Tasks',
  },
  render: (args) => (
    <div className='w-72'>
      <SectionHeading {...args} />
    </div>
  ),
});
