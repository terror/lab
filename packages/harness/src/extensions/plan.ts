import {
  type ConversationId,
  type Cursor,
  type ToolExecutionResult,
  type Tx,
  defineExtension,
  defineTool,
  section,
} from '@earendil-works/pi-durable';
import { arr, obj, oneOf, str } from '@earendil-works/pi-schema';

import {
  PLAN_LIMIT,
  PLAN_STATUSES,
  type Plan,
  type PlanStep,
  STEP_LENGTH,
} from '../plan';
import { conversationDoc } from './docs';
import { failure, text } from './results';

export const PlanDoc = conversationDoc<Plan>('lab.plan', () => ({
  author: 'agent',
  callId: null,
  steps: [],
}));

const GUIDANCE =
  'When a task takes several steps, call plan_update with a short checklist before you start, then update it as you go: mark a step active when you start it and done as soon as it is finished. The user sees the checklist live and can edit it while you work.';

const EDITED =
  'The user edited the plan. Follow their version, and keep their changes when you update it.';

function listing(steps: readonly PlanStep[]) {
  if (steps.length === 0) {
    return 'The plan has no steps.';
  }

  const lines = steps.map(
    ({ status, text: step }, index) => `${index + 1}. [${status}] ${step}`
  );

  return `The plan:\n${lines.join('\n')}`;
}

function planLines({ author, steps }: Plan) {
  if (author === 'user') {
    return [listing(steps), EDITED];
  }

  return steps.length > 0 ? [listing(steps)] : [];
}

function prompt(plan: Plan) {
  return `<plan>\n${[GUIDANCE, ...planLines(plan)].join('\n\n')}\n</plan>`;
}

async function shownPlan(
  tx: Tx,
  conversationId: ConversationId,
  cursor?: Cursor
): Promise<string | null | undefined> {
  const page = await tx.scanEntries({ conversationId }, 100, cursor);

  const [latest] = page.items.flatMap(({ model }) => {
    const [message] = model ?? [];

    return message?.role === 'system' && message.sections?.plan !== undefined
      ? [message.sections.plan]
      : [];
  });

  if (latest !== undefined) {
    return latest;
  }

  return page.next === undefined
    ? undefined
    : shownPlan(tx, conversationId, page.next);
}

async function planBefore(
  tx: Tx,
  conversationId: ConversationId,
  cursor?: Cursor
): Promise<Plan> {
  const page = await tx.scanEntries({ conversationId }, 100, cursor);

  const [latest] = page.items.flatMap(({ model }): Plan[] => {
    const [message] = model ?? [];

    if (
      message?.role !== 'toolResult' ||
      message.toolName !== 'plan_update' ||
      message.isError
    ) {
      return [];
    }

    const { steps } = message.details as { steps: PlanStep[] };

    return [{ author: 'agent', callId: message.toolCallId, steps }];
  });

  if (latest !== undefined) {
    return latest;
  }

  return page.next === undefined
    ? PlanDoc.definition.initial()
    : planBefore(tx, conversationId, page.next);
}

export async function rewindPlan(tx: Tx, conversationId: ConversationId) {
  Object.assign(
    await tx.doc(PlanDoc, conversationId),
    await planBefore(tx, conversationId)
  );
}

export async function editPlan(
  tx: Tx,
  conversationId: ConversationId,
  steps: PlanStep[]
) {
  const doc = await tx.doc(PlanDoc, conversationId);

  if (doc.callId === null) {
    return false;
  }

  doc.author = 'user';
  doc.steps = steps;

  return true;
}

const planUpdate = defineTool({
  name: 'plan_update',
  description:
    'Replace your checklist plan. Pass every step, in order, each time; pass no steps to clear the plan.',
  callers: ['model'],
  replay: 'safe',
  parameters: obj({
    steps: arr(
      obj({
        status: oneOf(PLAN_STATUSES, {
          description:
            'pending before you start it, active while you work on it, done once it is finished.',
        }),
        text: str({
          description: 'What the step does, in a few words.',
          maxLength: STEP_LENGTH,
          minLength: 1,
        }),
      }),
      { description: 'The whole plan, in order.', maxItems: PLAN_LIMIT }
    ),
  }),
  execute: async ({ steps }, api, context): Promise<ToolExecutionResult> => {
    const edited = await api.commit(async (tx) => {
      const doc = await tx.doc(PlanDoc, api.conversationId);

      if (
        doc.author === 'user' &&
        (await shownPlan(tx, api.conversationId)) !== prompt(doc)
      ) {
        return listing(doc.steps);
      }

      doc.author = 'agent';
      doc.callId = api.callId;
      doc.steps = steps;

      return undefined;
    }, context);

    if (edited !== undefined) {
      return failure(
        `The user edited the plan since you last saw it, so your update was not saved. ${edited}\n\nFollow their plan, and keep their changes if you update it again.`
      );
    }

    return { details: { steps }, output: text('Updated the plan.') };
  },
});

export const plan = defineExtension({
  name: 'lab.plan',
  sections: [
    section(
      'plan',
      async ({ conversationId, read }, context) =>
        prompt(
          (await read.snapshot(PlanDoc, conversationId, context)) ??
            PlanDoc.definition.initial()
        ),
      { tag: false }
    ),
  ],
  tools: [planUpdate],
});
