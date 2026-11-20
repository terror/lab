import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { ping } from '@lab/db';
import * as Sentry from '@sentry/bun';
import { Hono } from 'hono';
import { generateSpecs } from 'hono-openapi';
import { bodyLimit } from 'hono/body-limit';
import { compress } from 'hono/compress';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { auth, requireUser } from './auth';
import changelog from './changelog';
import computer from './computer';
import { clientMetadata, clientMetadataUrl } from './connector-auth';
import connectors from './connectors';
import conversations from './conversations';
import { db } from './db';
import { docsPage } from './docs';
import { env } from './env';
import frame, { framePaths } from './frame';
import { harness } from './harness';
import library from './library';
import memory from './memory';
import { defaultModel, listModels } from './models';
import { errorResponse, errorResponses, tagByResource } from './openapi';
import preferences from './preferences';
import profile from './profile';
import projects from './projects';
import providers from './providers';
import schedules from './schedules';
import search from './search';
import { contentSecurityPolicy, docsSecurityPolicy } from './security';
import { site } from './site';
import skills from './skills';
import trash from './trash';
import uploads from './uploads';
import usage from './usage';

const AUTH_BODY_BYTES = 64 * 1024;

const web = fileURLToPath(new URL('../../web/dist', import.meta.url));

const shell = await readFile(`${web}/index.html`, 'utf8').catch(() => '');

const app = new Hono();

export function logRequest(line: string) {
  console.log(line.replace(/\?\S*/, ''));
}

if (process.env.NODE_ENV !== 'test') {
  app.use(logger(logRequest));
}
app.use('/api/*', compress());
const headers = {
  permissionsPolicy: {
    bluetooth: [],
    camera: [],
    clipboardRead: [],
    clipboardWrite: ['self'],
    displayCapture: [],
    geolocation: [],
    hid: [],
    idleDetection: [],
    microphone: ['self'],
    midi: [],
    payment: [],
    screenWakeLock: [],
    serial: [],
    usb: [],
  },
  referrerPolicy: 'strict-origin-when-cross-origin',
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  xFrameOptions: 'DENY',
};

const appHeaders = secureHeaders({
  ...headers,
  contentSecurityPolicy: contentSecurityPolicy(shell),
});

const docsHeaders = secureHeaders({
  ...headers,
  contentSecurityPolicy: docsSecurityPolicy(docsPage),
});

app.use(async (c, next) => {
  if (framePaths.has(c.req.path)) {
    return next();
  }

  const apply = c.req.path === '/api/docs' ? docsHeaders : appHeaders;

  let own: string | null = null;

  await apply(c, async () => {
    await next();
    own = c.res.headers.get('content-security-policy');
  });

  if (own) {
    c.res.headers.set('content-security-policy', own);
  }
});

const api = new Hono()
  .get('/health', async (c) => {
    await ping(db);

    const { scheduling } = await harness().inspect(BACKGROUND_CONTEXT);

    if (scheduling !== 'running') {
      throw new HTTPException(503, { message: 'Harness is not running' });
    }

    return c.json({ status: 'ok' });
  })
  .on(
    ['GET', 'POST'],
    '/auth/*',
    bodyLimit({
      maxSize: AUTH_BODY_BYTES,
      onError: () => {
        throw new HTTPException(413, { message: 'Request body is too large' });
      },
    }),
    (c) => auth.handler(c.req.raw)
  )
  .route('/', changelog)
  .get('/models', requireUser, async (c) => {
    const fallback = await defaultModel();

    return c.json({
      default: fallback
        ? { id: fallback.id, provider: fallback.provider }
        : null,
      models: await listModels(),
    });
  })
  .route('/computer', computer)
  .get('/connectors/client-metadata.json', (c) =>
    c.json({ ...clientMetadata, client_id: clientMetadataUrl })
  )
  .route('/connectors', connectors)
  .route('/conversations', conversations)
  .route('/preferences', preferences)
  .route('/profile', profile)
  .route('/projects', projects)
  .route('/providers', providers)
  .route('/library', library)
  .route('/memory', memory)
  .route('/schedules', schedules)
  .route('/search', search)
  .route('/skills', skills)
  .route('/trash', trash)
  .route('/uploads', uploads)
  .route('/usage', usage);

export type AppType = typeof api;

app.route('/api', api);
app.get('/api/openapi.json', requireUser, async (c) =>
  c.json(
    tagByResource(
      await generateSpecs(app, {
        documentation: {
          info: {
            description: 'The HTTP API behind the Lab web app.',
            title: 'Lab API',
            version: env.RAILWAY_GIT_COMMIT_SHA,
          },
        },
        defaultOptions: { ALL: { responses: errorResponses } },
        defaultValidationErrorResponse: errorResponse('Invalid request'),
        includeEmptyPaths: true,
        exclude: [
          '/api/openapi.json',
          '/api/docs',
          /^\/frame/,
          /^\/api\/auth\//,
        ],
      })
    )
  )
);

app.get('/api/docs', requireUser, (c) => c.html(docsPage));

app.all('/api/*', (c) => c.notFound());

app.route('/frame', frame);

app.route('/', site(web));

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }

  console.error(error);

  Sentry.captureException(error);

  return c.json({ error: 'Couldn’t finish that. Try again.' }, 500);
});

export default app;
