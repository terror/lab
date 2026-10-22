CREATE TABLE lab.sessions (
  "sessionId" text PRIMARY KEY,
  "ownerId" uuid NOT NULL REFERENCES "user" (id),
  "workspaceId" uuid REFERENCES organization (id),
  title text NOT NULL DEFAULT '',
  configuration jsonb NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_owner ON lab.sessions ("ownerId", "createdAt" DESC)
  WHERE "workspaceId" IS NULL;

CREATE INDEX sessions_workspace ON lab.sessions ("workspaceId", "createdAt" DESC)
  WHERE "workspaceId" IS NOT NULL;
