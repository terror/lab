import preview from '../../.storybook/preview';
import { themes } from '../../.storybook/themes';
import { ApprovalCard } from './approval-card';
import { QuestionCard } from './question-card';

const meta = preview.meta({
  decorators: [themes],
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  title: 'Patterns/Needs you',
});

const options = [
  'Weeknight recipes',
  'Balcony garden',
  'Leave them where they are',
];

const question =
  'Two recipe chats are also about the balcony garden. Where should they go?';

export const Question = meta.story({
  render: () => (
    <QuestionCard
      active
      answer={undefined}
      callId='call-1'
      conversationId={1}
      options={options}
      question={question}
    />
  ),
});

export const Approval = meta.story({
  render: () => (
    <ApprovalCard
      active
      approval={{
        action: 'Change a scheduled task',
        summary: [
          'Task: Monday motivation',
          'Cron: 0 9 * * 1',
          'Prompt: Send a short nudge for the week ahead.',
        ],
      }}
      callId='call-2'
      conversationId={1}
    />
  ),
});

export const Stopped = meta.story({
  render: () => (
    <QuestionCard
      active={false}
      answer={undefined}
      callId='call-3'
      conversationId={1}
      options={options}
      question={question}
    />
  ),
});
