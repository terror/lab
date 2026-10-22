import { z } from 'zod';

import {
  type SessionRole,
  type SessionVisibility,
  sessionIdSchema,
  sessionRoleSchema,
  sessionVisibilitySchema,
  workspaceIdSchema,
} from './access';
import type { Workspace } from './workspaces';

export const sessionCreationSchema = z.strictObject({
  workspaceId: workspaceIdSchema,
  title: z.string().trim().max(200).default(''),
  visibility: sessionVisibilitySchema.default('restricted'),
});

export const sessionUpdateSchema = z.strictObject({
  title: z.string().trim().max(200),
});

export const sessionAccessSchema = z.strictObject({ role: sessionRoleSchema });

export const sessionVisibilityUpdateSchema = z.strictObject({
  visibility: sessionVisibilitySchema,
});

export const sessionMoveSchema = z.strictObject({ workspaceId: z.uuid() });

export const submissionSchema = z.strictObject({
  sessionId: sessionIdSchema,
  requestId: z.string().min(1).max(128),
  text: z.string().min(1),
  kind: z.enum(['prompt', 'steer', 'followUp']).optional(),
});

export type SessionMetadata = {
  sessionId: string;
  workspaceId: string;
  workspaceKind: Workspace['kind'];
  ownerId: string | null;
  organizationId: string | null;
  createdById: string | null;
  visibility: SessionVisibility;
  role: SessionRole;
  canTransfer: boolean;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type SubmissionMetadata = {
  requestId: string;
  submissionId: string | null;
  submittedById: string | null;
  createdAt: string;
};

export type SessionCreated = Pick<SessionMetadata, 'sessionId'>;
export type SessionCreation = z.infer<typeof sessionCreationSchema>;
export type SessionCreationInput = z.input<typeof sessionCreationSchema>;
export type SessionUpdate = z.infer<typeof sessionUpdateSchema>;

export type ChatSubmission = z.infer<typeof submissionSchema>;
