import { ApprovalSummary } from '@/components/approval-card';
import { QuestionOptions } from '@/components/question-card';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Button } from './button';
import { NeedsYouCard } from './needs-you-card';

const meta = preview.meta({
  component: NeedsYouCard,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'A chat that is waiting on you, shown outside the chat. The card always names the chat and shows what Lab asked in full, with a way to open the chat. A question shows every option at equal weight, with no default. An approval shows the action and its summary with Review and Deny; approving happens in the chat, never here.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Needs you card',
});

export const Review = meta.story({
  render: () => (
    <NeedsYouCard
      actions={
        <Button size='sm' variant='outline'>
          Review
        </Button>
      }
      className='w-120'
      title={<a href='#foo'>Balcony watering schedule</a>}
    />
  ),
});

export const Question = meta.story({
  render: () => (
    <NeedsYouCard
      actions={
        <Button size='sm' variant='quiet'>
          Open chat
        </Button>
      }
      className='w-120'
      title={<a href='#foo'>Sourdough starter names</a>}
    >
      <p>What tone should the names have?</p>
      <QuestionOptions
        disabled={false}
        onPick={() => undefined}
        options={[
          'Whimsical',
          'Dignified, like a ship or a racehorse',
          'Puns, the worse the better',
        ]}
      />
    </NeedsYouCard>
  ),
});

export const Approval = meta.story({
  render: () => (
    <NeedsYouCard
      actions={
        <>
          <Button size='sm' variant='outline'>
            Review
          </Button>
          <Button size='sm' variant='ghost'>
            Deny
          </Button>
        </>
      }
      className='w-120'
      title={<a href='#foo'>Monday motivation</a>}
    >
      <ApprovalSummary
        action='Schedule “Monday motivation”'
        summary={['Every Monday at 9:00, send a short nudge for the week.']}
      />
    </NeedsYouCard>
  ),
});
