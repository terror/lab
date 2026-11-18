import { PLAN_STATUSES, type PlanStatus } from '@lab/server/schemas';
import { ListChecks } from 'lucide-react';

import { field, text } from './format';
import { PreviewList } from './previews';
import { type ToolRenderer } from './types';

const statusLabels: Record<PlanStatus, string> = {
  active: 'in progress',
  done: 'done',
  pending: 'to do',
};

function isStatus(value: unknown): value is PlanStatus {
  return PLAN_STATUSES.some((status) => status === value);
}

export const planRenderers = {
  plan_update: {
    icon: ListChecks,
    preview: ({ args }) => {
      const steps = Array.isArray(args.steps) ? args.steps : [];

      return (
        <PreviewList
          items={steps.map((step: unknown, index) => {
            const status = field(step, 'status');

            return {
              key: String(index),
              label: text(field(step, 'text')) ?? '',
              meta: isStatus(status) ? statusLabels[status] : undefined,
            };
          })}
        />
      );
    },
    title: ({ active }) => (active ? 'Updating the plan' : 'Updated the plan'),
  },
} satisfies Record<string, ToolRenderer>;
