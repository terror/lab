import type { ChatSubmission, SubmissionMetadata } from '@lab/shared';
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { createHash } from 'node:crypto';

import { type Principal } from '../auth/access';
import { database } from '../db';
import { sessionSubmissions, sessions } from '../db/schema';

export async function reserveSubmission(
  principal: Principal,
  sessionId: string,
  input: Omit<ChatSubmission, 'sessionId'>
): Promise<void> {
  const inputHash = createHash('sha256')
    .update(JSON.stringify({ text: input.text, kind: input.kind ?? 'prompt' }))
    .digest('hex');

  const rows = await database
    .insert(sessionSubmissions)
    .values({
      sessionId,
      requestId: input.requestId,
      submittedById: principal.userId,
      inputHash,
    })
    .onConflictDoUpdate({
      target: [sessionSubmissions.sessionId, sessionSubmissions.requestId],
      set: { requestId: input.requestId },
      setWhere: and(
        eq(sessionSubmissions.submittedById, principal.userId),
        eq(sessionSubmissions.inputHash, inputHash)
      ),
    })
    .returning({ requestId: sessionSubmissions.requestId });

  if (rows.length === 0) {
    throw new HTTPException(409, {
      message:
        'This message conflicts with an earlier submission. Edit it and send it again.',
    });
  }
}

export async function completeSubmission(
  sessionId: string,
  requestId: string,
  submissionId: string
): Promise<void> {
  await database.transaction(async (transaction) => {
    const rows = await transaction
      .update(sessionSubmissions)
      .set({ submissionId })
      .where(
        and(
          eq(sessionSubmissions.sessionId, sessionId),
          eq(sessionSubmissions.requestId, requestId),
          or(
            isNull(sessionSubmissions.submissionId),
            eq(sessionSubmissions.submissionId, submissionId)
          )
        )
      )
      .returning({ sessionId: sessionSubmissions.sessionId });

    if (rows.length === 0) {
      throw new HTTPException(409, {
        message:
          'Submission reservation is missing or has a different submission ID',
      });
    }

    await transaction
      .update(sessions)
      .set({ updatedAt: sql`greatest(${sessions.updatedAt}, now())` })
      .where(eq(sessions.sessionId, sessionId));
  });
}

export async function listSubmissions(
  sessionId: string
): Promise<SubmissionMetadata[]> {
  const rows = await database
    .select({
      requestId: sessionSubmissions.requestId,
      submissionId: sessionSubmissions.submissionId,
      submittedById: sessionSubmissions.submittedById,
      createdAt: sessionSubmissions.createdAt,
    })
    .from(sessionSubmissions)
    .where(eq(sessionSubmissions.sessionId, sessionId))
    .orderBy(
      asc(sessionSubmissions.createdAt),
      asc(sessionSubmissions.requestId)
    );

  return rows.map((submission) => ({
    requestId: submission.requestId,
    submissionId: submission.submissionId,
    submittedById: submission.submittedById,
    createdAt: submission.createdAt.toISOString(),
  }));
}
