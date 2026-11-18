import {
  type AssistantMessage,
  type Models,
  contentText,
} from '@earendil-works/pi-ai';
import type { ConversationId, ModelRef } from '@earendil-works/pi-durable';

export type HelperKind = 'artifact' | 'compaction' | 'status' | 'title';

export type HelperUsage = (
  conversationId: ConversationId,
  kind: HelperKind,
  message: AssistantMessage
) => void;

const helpers: Partial<Record<string, string>> = {
  anthropic: 'claude-haiku-5-5',
  google: 'gemini-2.5-flash-lite',
  openai: 'gpt-5-nano',
  openrouter: 'anthropic/claude-haiku-5.5',
  'vercel-ai-gateway': 'anthropic/claude-haiku-5.5',
};

type HelperModel = NonNullable<ReturnType<typeof helperModel>>;

export async function completeHelper(
  models: Models,
  model: HelperModel,
  {
    input,
    maxTokens,
    prompt,
    signal,
  }: { input: string; maxTokens: number; prompt: string; signal?: AbortSignal }
) {
  const message = await models.completeSimple(
    model,
    {
      systemPrompt: prompt,
      messages: [{ content: input, role: 'user', timestamp: Date.now() }],
    },
    { maxTokens, signal }
  );

  const text = contentText(message.content, '').trim();

  return { message, text };
}

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
