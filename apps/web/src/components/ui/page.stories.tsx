import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Button } from './button';
import { Page, PageHeader } from './page';

const meta = preview.meta({
  component: PageHeader,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'Page sets the one content width and PageHeader the one title block for content pages: Scheduled, Library, Settings, Trash, and projects.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Page',
});

export const Header = meta.story({
  args: {
    actions: (
      <>
        <Button variant='quiet'>Export</Button>
        <Button>Add memory</Button>
      </>
    ),
    description: 'What Lab remembers about you across chats.',
    title: 'Memory',
  },
  render: (args) => (
    <Page className='p-0'>
      <PageHeader {...args} />
    </Page>
  ),
});
