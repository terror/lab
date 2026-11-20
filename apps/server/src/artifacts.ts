import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Conversation } from '@earendil-works/pi-durable';
import {
  type Artifact,
  ArtifactsDoc,
  STORE_KEY_LENGTH,
  STORE_VALUE_LENGTH,
} from '@lab/harness';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';

import { ASK_PROMPT_LENGTH, askModel } from './artifact-ask';
import { pinArtifact, unpinArtifact } from './artifact-pins';
import { deleteValue, readValue, saveValue } from './artifact-state';
import { ownedChat } from './chat-actions';
import { found } from './found';
import { harness } from './harness';
import { rateLimit } from './limits';
import { checkSpend } from './spend';
import { positiveId, validator } from './validator';

const artifactParams = validator(
  'param',
  z.object({
    artifactId: z.string().regex(/^[a-z0-9-]{1,40}$/),
    id: positiveId,
  })
);

const stateKey = validator(
  'query',
  z.object({ key: z.string().min(1).max(STORE_KEY_LENGTH) })
);

const stateValue = validator(
  'json',
  z.object({ value: z.string().max(STORE_VALUE_LENGTH) })
);

const asking = validator(
  'json',
  z.object({ prompt: z.string().trim().min(1).max(ASK_PROMPT_LENGTH) })
);

const pinning = validator(
  'json',
  z.object({ projectId: z.number().int().positive().nullable() })
);

const artifact = createMiddleware<{
  Variables: { artifact: Artifact; conversation: Conversation };
}>(async (c, next) => {
  const doc = await harness().snapshot(
    ArtifactsDoc,
    c.var.conversation.id,
    BACKGROUND_CONTEXT
  );

  c.set(
    'artifact',
    found(doc?.artifacts[c.req.param('artifactId') ?? ''], 'Artifact not found')
  );

  await next();
});

const artifacts = new Hono()
  .get('/:artifactId', artifactParams, ownedChat, artifact, async (c) => {
    const { content, title, version } = c.var.artifact;

    return c.json({ content, title, version });
  })
  .put(
    '/:artifactId/pin',
    artifactParams,
    ownedChat,
    artifact,
    pinning,
    async (c) => {
      found(
        await pinArtifact(
          c.get('user').id,
          c.var.conversation.id,
          c.req.valid('param').artifactId,
          c.req.valid('json').projectId
        ),
        'Project not found'
      );

      return c.body(null, 204);
    }
  )
  .delete('/:artifactId/pin', artifactParams, ownedChat, async (c) => {
    await unpinArtifact(c.var.conversation.id, c.req.valid('param').artifactId);

    return c.body(null, 204);
  })
  .get(
    '/:artifactId/state',
    artifactParams,
    ownedChat,
    artifact,
    stateKey,
    async (c) => {
      const { artifactId } = c.req.valid('param');

      return c.json({
        value: await readValue(
          c.var.conversation.id,
          artifactId,
          c.req.valid('query').key
        ),
      });
    }
  )
  .put(
    '/:artifactId/state',
    artifactParams,
    ownedChat,
    artifact,
    stateKey,
    stateValue,
    async (c) => {
      await saveValue(
        c.get('user').id,
        c.var.conversation.id,
        c.req.valid('param').artifactId,
        { key: c.req.valid('query').key, value: c.req.valid('json').value }
      );

      return c.body(null, 204);
    }
  )
  .delete(
    '/:artifactId/state',
    artifactParams,
    ownedChat,
    artifact,
    stateKey,
    async (c) => {
      await deleteValue(
        c.var.conversation.id,
        c.req.valid('param').artifactId,
        c.req.valid('query').key
      );

      return c.body(null, 204);
    }
  )
  .post(
    '/:artifactId/ask',
    rateLimit('asks'),
    artifactParams,
    ownedChat,
    artifact,
    asking,
    async (c) => {
      await checkSpend(c.get('user').id);

      return c.json({
        text: await askModel(
          c.var.conversation.id,
          c.req.valid('json').prompt,
          c.req.raw.signal
        ),
      });
    }
  );

export default artifacts;
