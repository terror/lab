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
          'A chat that is waiting on you, shown outside the chat. The card always names the chat and shows what Lab asked in full, with a way to open the chat. Pass link to make the chat’s name open it. Name each action with the chat, so a list of cards reads apart. A question shows every option at equal weight, with no default. An approval shows the action and its summary with Review and Deny; approving happens in the chat, never here.',
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
        <Button
          aria-label='Review Balcony watering schedule'
          size='sm'
          variant='outline'
        >
          Review
        </Button>
      }
      className='w-120'
      link={(title) => <a href='#foo'>{title}</a>}
      title='Balcony watering schedule'
    />
  ),
});

export const Question = meta.story({
  render: () => (
    <NeedsYouCard
      actions={
        <Button
          aria-label='Open Sourdough starter names'
          size='sm'
          variant='quiet'
        >
          Open chat
        </Button>
      }
      className='w-120'
      link={(title) => <a href='#foo'>{title}</a>}
      title='Sourdough starter names'
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
          <Button
            aria-label='Review Monday motivation'
            size='sm'
            variant='outline'
          >
            Review
          </Button>
          <Button aria-label='Deny Monday motivation' size='sm' variant='ghost'>
            Deny
          </Button>
        </>
      }
      className='w-120'
      link={(title) => <a href='#foo'>{title}</a>}
      title='Monday motivation'
    >
      <ApprovalSummary
        action='Schedule “Monday motivation”'
        summary={['Every Monday at 9:00, send a short nudge for the week.']}
      />
    </NeedsYouCard>
  ),
});
