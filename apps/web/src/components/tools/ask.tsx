import { QuestionCard } from '@/components/question-card';
import { MessageCircleQuestion } from 'lucide-react';
import { useContext } from 'react';

import { field, text } from './format';
import { ToolConversation, type ToolRenderer, type ToolView } from './types';

function AskUser({ args, callId, details }: ToolView) {
  const conversationId = useContext(ToolConversation);

  const question = text(field(details, 'question')) ?? text(args.question);

  const options = field(details, 'options') ?? args.options;

  if (!question || !Array.isArray(options)) {
    return null;
  }

  return (
    <QuestionCard
      answer={text(field(details, 'answer'))}
      callId={callId}
      conversationId={conversationId}
      options={options.filter((option) => typeof option === 'string')}
      question={question}
    />
  );
}

export const askRenderers: Record<string, ToolRenderer> = {
  ask_user: {
    icon: MessageCircleQuestion,
    inline: (view) => <AskUser {...view} />,
    title: ({ active }) =>
      active ? 'Asking you a question' : 'Asked you a question',
  },
};
