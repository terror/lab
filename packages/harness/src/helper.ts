import type { AssistantMessage, Models } from '@earendil-works/pi-ai';
import type { ConversationId, ModelRef } from '@earendil-works/pi-durable';

export type HelperUsage = (
  conversationId: ConversationId,
  kind: 'status' | 'title',
  message: AssistantMessage
) => void;

const helpers: Partial<Record<string, string>> = {
  anthropic: 'claude-haiku-5-5',
  google: 'gemini-2.5-flash-lite',
  openai: 'gpt-5-nano',
  openrouter: 'anthropic/claude-haiku-5.5',
  'vercel-ai-gateway': 'anthropic/claude-haiku-5.5',
};

export function helperModel(models: Models, ref: ModelRef | undefined) {
  if (!ref) {
    return undefined;
  }

  const helper = helpers[ref.provider];

  return (
    (helper && models.getModel(ref.provider, helper)) ||
    models.getModel(ref.provider, ref.modelId)
  );
}
