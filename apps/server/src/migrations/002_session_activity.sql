DROP INDEX lab.sessions_owner, lab.sessions_workspace;

CREATE INDEX sessions_owner ON lab.sessions ("ownerId", "updatedAt" DESC, "sessionId" DESC)
  WHERE "workspaceId" IS NULL;

CREATE INDEX sessions_workspace ON lab.sessions ("workspaceId", "updatedAt" DESC, "sessionId" DESC)
  WHERE "workspaceId" IS NOT NULL;
