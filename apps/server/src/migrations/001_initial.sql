CREATE SCHEMA "lab";

CREATE TABLE "account" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" uuid NOT NULL,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamp with time zone,
  "refreshTokenExpiresAt" timestamp with time zone,
  "scope" text,
  "password" text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone NOT NULL
);

CREATE TABLE "session" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "expiresAt" timestamp with time zone NOT NULL,
  "token" text NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" uuid NOT NULL,
  "activeOrganizationId" text,

  CONSTRAINT "session_token_key"
    UNIQUE ("token")
);

CREATE TABLE "invitation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organizationId" uuid NOT NULL,
  "email" text NOT NULL,
  "role" text,
  "status" text NOT NULL,
  "expiresAt" timestamp with time zone NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "inviterId" uuid NOT NULL
);

CREATE TABLE "member" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organizationId" uuid NOT NULL,
  "userId" uuid NOT NULL,
  "role" text NOT NULL,
  "createdAt" timestamp with time zone NOT NULL
);

CREATE TABLE "organization" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "logo" text,
  "createdAt" timestamp with time zone NOT NULL,
  "metadata" text,

  CONSTRAINT "organization_slug_key"
    UNIQUE ("slug")
);

CREATE TABLE "lab"."session_access" (
  "sessionId" text NOT NULL,
  "userId" uuid NOT NULL,
  "role" text NOT NULL,

  CONSTRAINT "session_access_sessionId_userId_pk"
    PRIMARY KEY ("sessionId", "userId"),
  CONSTRAINT "session_access_role_check"
    CHECK (
      "lab"."session_access"."role" IN ('viewer', 'editor', 'manager')
    )
);

CREATE TABLE "lab"."session_submissions" (
  "sessionId" text NOT NULL,
  "requestId" text NOT NULL,
  "submittedById" uuid,
  "inputHash" text NOT NULL,
  "submissionId" text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,

  CONSTRAINT "session_submissions_sessionId_requestId_pk"
    PRIMARY KEY ("sessionId", "requestId"),
  CONSTRAINT "session_submissions_sessionId_submissionId_key"
    UNIQUE ("sessionId", "submissionId"),
  CONSTRAINT "session_submissions_requestId_check"
    CHECK (
      length("lab"."session_submissions"."requestId") BETWEEN 1 AND 128
    )
);

CREATE TABLE "lab"."sessions" (
  "sessionId" text PRIMARY KEY NOT NULL,
  "workspaceId" uuid NOT NULL,
  "createdById" uuid,
  "visibility" text DEFAULT 'restricted' NOT NULL,
  "title" text DEFAULT '' NOT NULL,
  "configuration" jsonb NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,

  CONSTRAINT "sessions_visibility_check"
    CHECK (
      "lab"."sessions"."visibility" IN ('restricted', 'workspace')
    )
);

CREATE TABLE "user" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "emailVerified" boolean NOT NULL,
  "image" text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,

  CONSTRAINT "user_email_key"
    UNIQUE ("email")
);

CREATE TABLE "verification" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamp with time zone NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "lab"."workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" text NOT NULL,
  "ownerId" uuid,
  "organizationId" uuid,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,

  CONSTRAINT "workspaces_ownerId_key"
    UNIQUE ("ownerId"),
  CONSTRAINT "workspaces_organizationId_key"
    UNIQUE ("organizationId"),
  CONSTRAINT "workspaces_kind_check"
    CHECK (
      "lab"."workspaces"."kind" IN ('personal', 'family')
    ),
  CONSTRAINT "workspaces_ownership_check"
    CHECK (
      (
        "lab"."workspaces"."kind" = 'personal'
        AND "lab"."workspaces"."ownerId" IS NOT NULL
        AND "lab"."workspaces"."organizationId" IS NULL
      )
      OR (
        "lab"."workspaces"."kind" = 'family'
        AND "lab"."workspaces"."ownerId" IS NULL
        AND "lab"."workspaces"."organizationId" IS NOT NULL
      )
    )
);

ALTER TABLE "account"
  ADD CONSTRAINT "account_userId_user_id_fk"
  FOREIGN KEY ("userId")
  REFERENCES "public"."user" ("id")
  ON DELETE cascade
  ON UPDATE no action;

ALTER TABLE "session"
  ADD CONSTRAINT "session_userId_user_id_fk"
  FOREIGN KEY ("userId")
  REFERENCES "public"."user" ("id")
  ON DELETE cascade
  ON UPDATE no action;

ALTER TABLE "invitation"
  ADD CONSTRAINT "invitation_organizationId_organization_id_fk"
  FOREIGN KEY ("organizationId")
  REFERENCES "public"."organization" ("id")
  ON DELETE cascade
  ON UPDATE no action;

ALTER TABLE "invitation"
  ADD CONSTRAINT "invitation_inviterId_user_id_fk"
  FOREIGN KEY ("inviterId")
  REFERENCES "public"."user" ("id")
  ON DELETE cascade
  ON UPDATE no action;

ALTER TABLE "member"
  ADD CONSTRAINT "member_organizationId_organization_id_fk"
  FOREIGN KEY ("organizationId")
  REFERENCES "public"."organization" ("id")
  ON DELETE cascade
  ON UPDATE no action;

ALTER TABLE "member"
  ADD CONSTRAINT "member_userId_user_id_fk"
  FOREIGN KEY ("userId")
  REFERENCES "public"."user" ("id")
  ON DELETE cascade
  ON UPDATE no action;

ALTER TABLE "lab"."session_access"
  ADD CONSTRAINT "session_access_sessionId_sessions_sessionId_fk"
  FOREIGN KEY ("sessionId")
  REFERENCES "lab"."sessions" ("sessionId")
  ON DELETE cascade
  ON UPDATE no action;

ALTER TABLE "lab"."session_access"
  ADD CONSTRAINT "session_access_userId_user_id_fk"
  FOREIGN KEY ("userId")
  REFERENCES "public"."user" ("id")
  ON DELETE cascade
  ON UPDATE no action;

ALTER TABLE "lab"."session_submissions"
  ADD CONSTRAINT "session_submissions_sessionId_sessions_sessionId_fk"
  FOREIGN KEY ("sessionId")
  REFERENCES "lab"."sessions" ("sessionId")
  ON DELETE cascade
  ON UPDATE no action;

ALTER TABLE "lab"."session_submissions"
  ADD CONSTRAINT "session_submissions_submittedById_user_id_fk"
  FOREIGN KEY ("submittedById")
  REFERENCES "public"."user" ("id")
  ON DELETE set null
  ON UPDATE no action;

ALTER TABLE "lab"."sessions"
  ADD CONSTRAINT "sessions_workspaceId_workspaces_id_fk"
  FOREIGN KEY ("workspaceId")
  REFERENCES "lab"."workspaces" ("id")
  ON DELETE no action
  ON UPDATE no action;

ALTER TABLE "lab"."sessions"
  ADD CONSTRAINT "sessions_createdById_user_id_fk"
  FOREIGN KEY ("createdById")
  REFERENCES "public"."user" ("id")
  ON DELETE set null
  ON UPDATE no action;

ALTER TABLE "lab"."workspaces"
  ADD CONSTRAINT "workspaces_ownerId_user_id_fk"
  FOREIGN KEY ("ownerId")
  REFERENCES "public"."user" ("id")
  ON DELETE no action
  ON UPDATE no action;

ALTER TABLE "lab"."workspaces"
  ADD CONSTRAINT "workspaces_organizationId_organization_id_fk"
  FOREIGN KEY ("organizationId")
  REFERENCES "public"."organization" ("id")
  ON DELETE no action
  ON UPDATE no action;

CREATE INDEX "account_userId_idx"
  ON "account" USING btree ("userId");

CREATE INDEX "session_userId_idx"
  ON "session" USING btree ("userId");

CREATE INDEX "invitation_organizationId_idx"
  ON "invitation" USING btree ("organizationId");

CREATE INDEX "invitation_email_idx"
  ON "invitation" USING btree ("email");

CREATE INDEX "member_organizationId_idx"
  ON "member" USING btree ("organizationId");

CREATE INDEX "member_userId_idx"
  ON "member" USING btree ("userId");

CREATE INDEX "session_access_user"
  ON "lab"."session_access" USING btree ("userId", "sessionId");

CREATE INDEX "sessions_workspace"
  ON "lab"."sessions" USING btree (
    "workspaceId",
    "updatedAt" DESC NULLS LAST,
    "sessionId" DESC NULLS LAST
  );

CREATE INDEX "verification_identifier_idx"
  ON "verification" USING btree ("identifier");
