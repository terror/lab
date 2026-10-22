import { z } from 'zod';

export const workspaceIdSchema = z.uuid().nullable().default(null);

export const sessionIdSchema = z
  .string()
  .regex(/^wrun_[0-9A-HJKMNP-TV-Z]{26}$/);

export const sessionRoleSchema = z.enum(['viewer', 'editor', 'manager']);
export const sessionVisibilitySchema = z.enum(['restricted', 'workspace']);

export type SessionRole = z.infer<typeof sessionRoleSchema>;
export type SessionVisibility = z.infer<typeof sessionVisibilitySchema>;
