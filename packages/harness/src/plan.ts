export const PLAN_STATUSES = ['pending', 'active', 'done'] as const;

export const PLAN_LIMIT = 20;

export const STEP_LENGTH = 200;

export type PlanStatus = (typeof PLAN_STATUSES)[number];

export type PlanStep = { status: PlanStatus; text: string };

export type Plan = {
  author: 'agent' | 'user';
  callId: string | null;
  steps: PlanStep[];
};
