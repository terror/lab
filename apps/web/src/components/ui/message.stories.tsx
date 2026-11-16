import preview from '../../../.storybook/preview';
import { Bubble, BubbleContent } from './bubble';
import { Message, MessageContent } from './message';

const meta = preview.meta({
  component: Message,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  title: 'Components/Message',
});

export const Conversation = meta.story({
  render: () => (
    <div className='flex max-w-2xl flex-col gap-6'>
      <Message align='end'>
        <MessageContent>
          <Bubble align='end' variant='muted'>
            <BubbleContent className='rounded-2xl px-4 text-base'>
              Plan a three day trip to Kyoto.
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
      <Message>
        <MessageContent className='text-base'>
          <p>
            Start in the eastern hills, spend a day in Kitayama, and finish in
            Arashiyama before the crowds arrive.
          </p>
        </MessageContent>
      </Message>
    </div>
  ),
});
