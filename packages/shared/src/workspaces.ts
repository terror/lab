import { z } from 'zod';

export const workspaceCreationSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export type Workspace = {
  id: string;
  kind: 'personal' | 'family';
  ownerId: string | null;
  organizationId: string | null;
  name: string;
  createdAt: string;
};

export type WorkspaceCreation = z.input<typeof workspaceCreationSchema>;
