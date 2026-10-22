import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { bearer, organization } from 'better-auth/plugins';

import { config } from './config';
import { database } from './database';

export const auth = betterAuth({
  appName: 'Lab',
  baseURL: config.origin,
  basePath: '/api/auth',
  secret: config.authSecret,
  database,
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

          const invitation = await database.query(
            `SELECT id FROM invitation
             WHERE lower(email) = $1 AND status = 'pending' AND "expiresAt" > now()
             LIMIT 1`,
            [user.email.toLowerCase()]
          );

          if (invitation.rowCount === 0) {
            throw new APIError('FORBIDDEN', {
              message: 'An invitation is required to access Lab',
            });
          }
        },
      },
    },
  },
  plugins: [
    bearer({ requireSignature: true }),
    organization({
      requireEmailVerificationOnInvitation: true,
      disableOrganizationDeletion: true,
    }),
  ],
});
