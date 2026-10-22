import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import type { AgentConfiguration } from '../harness/agent';

export const user = pgTable('user', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique('user_email_key'),
  emailVerified: boolean('emailVerified').notNull(),
  image: text('image'),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updatedAt', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const authSession = pgTable(
  'session',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique('session_token_key'),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    activeOrganizationId: text('activeOrganizationId'),
  },
  (table) => [index('session_userId_idx').on(table.userId)]
);

export const account = pgTable(
  'account',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: timestamp('accessTokenExpiresAt', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', {
      withTimezone: true,
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)]
);

export const verification = pgTable(
  'verification',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
);

export const organization = pgTable('organization', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique('organization_slug_key'),
  logo: text('logo'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
  metadata: text('metadata'),
});

export const member = pgTable(
  'member',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organizationId')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('member_organizationId_idx').on(table.organizationId),
    index('member_userId_idx').on(table.userId),
  ]
);

export const invitation = pgTable(
  'invitation',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organizationId')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role'),
    status: text('status').notNull(),
    expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .defaultNow()
      .notNull(),
    inviterId: uuid('inviterId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('invitation_organizationId_idx').on(table.organizationId),
    index('invitation_email_idx').on(table.email),
  ]
);

export const authSchema = {
  user,
  session: authSession,
  account,
  verification,
  organization,
  member,
  invitation,
};

export const lab = pgSchema('lab');

export const workspaces = lab.table(
  'workspaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    kind: text('kind', { enum: ['personal', 'family'] }).notNull(),
    ownerId: uuid('ownerId')
      .unique('workspaces_ownerId_key')
      .references(() => user.id),
    organizationId: uuid('organizationId')
      .unique('workspaces_organizationId_key')
      .references(() => organization.id),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'workspaces_kind_check',
      sql`${table.kind} IN ('personal', 'family')`
    ),
    check(
      'workspaces_ownership_check',
      sql`(${table.kind} = 'personal' AND ${table.ownerId} IS NOT NULL AND ${table.organizationId} IS NULL)
        OR (${table.kind} = 'family' AND ${table.ownerId} IS NULL AND ${table.organizationId} IS NOT NULL)`
    ),
  ]
);

export const sessions = lab.table(
  'sessions',
  {
    sessionId: text('sessionId').primaryKey(),
    workspaceId: uuid('workspaceId')
      .notNull()
      .references(() => workspaces.id),
    createdById: uuid('createdById').references(() => user.id, {
      onDelete: 'set null',
    }),
    visibility: text('visibility', { enum: ['restricted', 'workspace'] })
      .default('restricted')
      .notNull(),
    title: text('title').default('').notNull(),
    configuration: jsonb('configuration').$type<AgentConfiguration>().notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'sessions_visibility_check',
      sql`${table.visibility} IN ('restricted', 'workspace')`
    ),
    index('sessions_workspace').on(
      table.workspaceId,
      table.updatedAt.desc(),
      table.sessionId.desc()
    ),
  ]
);

export const sessionAccess = lab.table(
  'session_access',
  {
    sessionId: text('sessionId')
      .notNull()
      .references(() => sessions.sessionId, { onDelete: 'cascade' }),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['viewer', 'editor', 'manager'] }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.userId] }),
    check(
      'session_access_role_check',
      sql`${table.role} IN ('viewer', 'editor', 'manager')`
    ),
    index('session_access_user').on(table.userId, table.sessionId),
  ]
);

export const sessionSubmissions = lab.table(
  'session_submissions',
  {
    sessionId: text('sessionId')
      .notNull()
      .references(() => sessions.sessionId, { onDelete: 'cascade' }),
    requestId: text('requestId').notNull(),
    submittedById: uuid('submittedById').references(() => user.id, {
      onDelete: 'set null',
    }),
    inputHash: text('inputHash').notNull(),
    submissionId: text('submissionId'),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.requestId] }),
    unique('session_submissions_sessionId_submissionId_key').on(
      table.sessionId,
      table.submissionId
    ),
    check(
      'session_submissions_requestId_check',
      sql`length(${table.requestId}) BETWEEN 1 AND 128`
    ),
  ]
);
