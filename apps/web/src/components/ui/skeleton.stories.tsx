import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Skeleton } from './skeleton';

const meta = preview.meta({
  component: Skeleton,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'A placeholder bar while data loads. Build the shape of the page from a few of them. The shine halves its pace after 5 seconds and stops under reduced motion.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Skeleton',
});

export const Rows = meta.story({
  render: () => (
    <div aria-busy='true' className='flex w-72 flex-col gap-5'>
      {['w-3/5', 'w-1/2', 'w-2/3'].map((width) => (
        <div key={width} className='flex items-center gap-3'>
          <Skeleton className={width} />
          <Skeleton className='ml-auto w-11' />
        </div>
      ))}
    </div>
  ),
});
