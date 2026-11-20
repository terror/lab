import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { ArtifactsDoc } from '@lab/harness';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { db } from './db';
import { harness } from './harness';

const table = schema.artifactPin;

const projects = schema.project;

export async function listPins(ownerId: string) {
  const rows = await db
    .select({
      artifactId: table.artifactId,
      conversationId: table.conversationId,
      projectId: table.projectId,
      seenVersion: table.seenVersion,
    })
    .from(table)
    .innerJoin(
      schema.conversation,
      eq(schema.conversation.id, table.conversationId)
    )
    .leftJoin(projects, eq(projects.id, table.projectId))
    .where(
      and(
        eq(table.ownerId, ownerId),
        isNull(schema.conversation.deletedAt),
        isNull(projects.deletedAt)
      )
    )
    .orderBy(asc(table.createdAt));

  const pins = await Promise.all(
    rows.map(async (row) => {
      const doc = await harness.snapshot(
        ArtifactsDoc,
        row.conversationId as ConversationId,
        BACKGROUND_CONTEXT
      );

      const artifact = doc?.artifacts[row.artifactId];

      return artifact
        ? [{ ...row, title: artifact.title, version: artifact.version }]
        : [];
    })
  );

  return pins.flat();
}

export async function pinArtifact(
  ownerId: string,
  conversationId: number,
  artifactId: string,
  projectId: number | null,
  version: number
) {
  if (projectId !== null) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.ownerId, ownerId),
          isNull(projects.deletedAt)
        )
      );

    if (!project) {
      return false;
    }
  }

  await db
    .insert(table)
    .values({
      artifactId,
      conversationId,
      ownerId,
      projectId,
      seenVersion: version,
    })
    .onConflictDoUpdate({
      set: { projectId },
      target: [table.conversationId, table.artifactId],
    });

  return true;
}

export async function seeArtifact(
  conversationId: number,
  artifactId: string,
  version: number
) {
  await db
    .update(table)
    .set({ seenVersion: version })
    .where(
      and(
        eq(table.conversationId, conversationId),
        eq(table.artifactId, artifactId)
      )
    );
}

export async function unpinArtifact(
  conversationId: number,
  artifactId: string
) {
  await db
    .delete(table)
    .where(
      and(
        eq(table.conversationId, conversationId),
        eq(table.artifactId, artifactId)
      )
    );
}
