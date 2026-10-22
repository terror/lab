import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import type { BetterAuthOptions } from 'better-auth';
import { APIError } from 'better-auth/api';
import { bearer, organization } from 'better-auth/plugins';
import { and, eq, gt, sql } from 'drizzle-orm';

import { config } from '../config';
import { database } from '../db';
import { authSchema, invitation } from '../db/schema';
import {
  ensureFamilyWorkspace,
  ensurePersonalWorkspace,
} from '../services/workspaces';

export const authOptions = {
  appName: 'Lab',
  baseURL: config.origin,
  basePath: '/api/auth',
  secret: config.authSecret,
  database: drizzleAdapter(database, {
    provider: 'pg',
    schema: authSchema,
    camelCase: true,
    transaction: true,
  }),
  trustedOrigins: [config.origin],
  socialProviders: {
    google: {
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
      prompt: 'select_account',
    },
  },
  account: {
    encryptOAuthTokens: true,
    accountLinking: { enabled: false },
  },
  user: {
    validateUserInfo: async ({ user, source }) => {
      if (
        source.method !== 'oauth' ||
        source.oauth?.providerId !== 'google' ||
        !user.emailVerified
      ) {
        return {
          error: 'email_not_verified',
          errorDescription: 'A verified Google email address is required',
        };
      }
    },
  },
  session: { cookieCache: { enabled: false } },
  advanced: {
    cookiePrefix: 'lab',
    useSecureCookies: config.origin.startsWith('https:'),
    database: { generateId: 'uuid' },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!user.emailVerified) {
            throw new APIError('FORBIDDEN', {
              message: 'A verified Google email address is required',
            });
          }

          if (user.email.toLowerCase() === config.adminEmail) {
            return;
          }

          const [pending] = await database
            .select({ id: invitation.id })
            .from(invitation)
            .where(
              and(
                eq(sql`lower(${invitation.email})`, user.email.toLowerCase()),
                eq(invitation.status, 'pending'),
                gt(invitation.expiresAt, sql`now()`)
              )
            )
            .limit(1);

          if (!pending) {
            throw new APIError('FORBIDDEN', {
              message: 'An invitation is required to access Lab',
            });
          }
        },
        after: async (user) => {
          await ensurePersonalWorkspace(user.id);
        },
      },
    },
  },
  plugins: [
    bearer({ requireSignature: true }),
    organization({
      requireEmailVerificationOnInvitation: true,
      disableOrganizationDeletion: true,
      organizationHooks: {
        afterCreateOrganization: async ({ organization }) => {
          await ensureFamilyWorkspace(organization.id);
        },
      },
    }),
  ],
} satisfies BetterAuthOptions;
