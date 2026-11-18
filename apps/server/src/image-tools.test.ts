import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { schema } from '@lab/db';
import { expect, spyOn, test } from 'bun:test';
import { and, asc, eq, inArray } from 'drizzle-orm';

import { signIn, signInAdmin } from '../test/auth';
import { call, chat, settle, toolOutputs } from '../test/client';
import { prompts, script, toolCall } from '../test/models';
import { db } from './db';
import { env } from './env';

function image(usage?: object) {
  return Response.json({
    choices: [
      {
        message: {
          content: 'foo',
          images: [
            {
              image_url: { url: 'data:image/png;base64,Zm9v' },
              type: 'image_url',
            },
          ],
        },
      },
    ],
    usage,
  });
}

function url(input: string | Request | URL) {
  return new URL(input instanceof Request ? input.url : input);
}

async function respond(input: string | Request | URL, replies: Response[]) {
  if (url(input).pathname === '/v1/models') {
    return Response.json({
      data: [
        {
          id: env.LAB_IMAGE_MODEL,
          pricing: {
            image_dimension_quality_pricing: [{ cost: '0.5', size: 'default' }],
          },
        },
      ],
    });
  }

  return replies.shift() ?? Response.json({}, { status: 500 });
}

function stubGateway(...replies: Response[]) {
  return spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign((input: string | Request | URL) => respond(input, replies), {
      preconnect: fetch.preconnect,
    })
  );
}

async function connect() {
  await call(await signInAdmin(), 'PUT', '/providers/vercel-ai-gateway', {
    apiKey: 'qux',
    method: 'api_key',
  });
}

async function disconnect() {
  await call(await signInAdmin(), 'DELETE', '/providers/vercel-ai-gateway');
}

function generate(images: Record<string, number[]> = {}) {
  return toolCall('image_generate', { name: 'foo', prompt: 'bar', ...images });
}

async function latestLibraryId(headers: Headers): Promise<number> {
  const { body } = await call(headers, 'GET', '/library');

  return body.items[0].id;
}

test('the agent creates and edits images that land in the library', async () => {
  const headers = await signIn();

  const gateway = stubGateway(
    image({ completion_tokens: 2, cost: 0.04, prompt_tokens: 1 }),
    image()
  );

  prompts.length = 0;

  script(
    toolCall('image_generate', { name: 'foo', prompt: 'bar' }),
    fauxAssistantMessage('baz')
  );

  const missing = await chat(headers, { content: 'foo' });

  await connect();

  try {
    script(
      toolCall('image_generate', { name: 'foo.png', prompt: 'bar' }),
      fauxAssistantMessage('baz')
    );

    const created = await chat(headers, { content: 'foo' });

    const source = await latestLibraryId(headers);

    script(
      toolCall('image_generate', {
        images: [source],
        name: 'baz',
        prompt: 'qux',
      }),
      fauxAssistantMessage('baz')
    );

    const edited = await chat(headers, { content: 'foo' });

    const { body } = await call(headers, 'GET', '/library');

    const [, edit] = gateway.mock.calls.flatMap(([input, init]) =>
      url(input).pathname === '/v1/chat/completions' ? [init] : []
    );

    expect({
      edit: {
        authorization: new Headers(edit?.headers).get('authorization'),
        body: typeof edit?.body === 'string' ? JSON.parse(edit.body) : null,
      },
      library: body.items.map(
        ({ id, kind, mimeType, name, size }: Record<string, unknown>) => ({
          id,
          kind,
          mimeType,
          name,
          size,
        })
      ),
      outputs: [
        await toolOutputs(headers, missing),
        await toolOutputs(headers, created),
        await toolOutputs(headers, edited),
      ],
      sections: [prompts[0]?.images, prompts.at(-1)?.images],
      usage: await db
        .select({
          cost: schema.usageEvent.cost,
          input: schema.usageEvent.input,
          model: schema.usageEvent.model,
          output: schema.usageEvent.output,
          provider: schema.usageEvent.provider,
        })
        .from(schema.usageEvent)
        .where(
          and(
            inArray(schema.usageEvent.conversationId, [created, edited]),
            eq(schema.usageEvent.kind, 'image')
          )
        )
        .orderBy(asc(schema.usageEvent.id)),
    }).toEqual({
      edit: {
        authorization: 'Bearer qux',
        body: {
          messages: [
            {
              content: [
                { text: 'qux', type: 'text' },
                {
                  image_url: { url: 'data:image/png;base64,Zm9v' },
                  type: 'image_url',
                },
              ],
              role: 'user',
            },
          ],
          modalities: ['text', 'image'],
          model: 'google/gemini-3.1-flash-image',
        },
      },
      library: [
        {
          id: body.items[0].id,
          kind: 'image',
          mimeType: 'image/png',
          name: 'baz.png',
          size: 3,
        },
        {
          id: source,
          kind: 'image',
          mimeType: 'image/png',
          name: 'foo.png',
          size: 3,
        },
      ],
      outputs: [
        [
          "Image generation isn't set up. The user can add a Vercel AI Gateway key in Settings → Providers.",
        ],
        [`Saved foo.png to the library as id ${source}.`],
        [`Saved baz.png to the library as id ${body.items[0].id}.`],
      ],
      sections: [
        undefined,
        "<images>\nYou can create images with image_generate. To edit or combine images, pass their library ids, which library_search finds. Each image is saved to the user's library and shown in the chat.\n</images>",
      ],
      usage: [
        {
          cost: 0.04,
          input: 1,
          model: 'google/gemini-3.1-flash-image',
          output: 2,
          provider: 'vercel-ai-gateway',
        },
        {
          cost: 0.5,
          input: 0,
          model: 'google/gemini-3.1-flash-image',
          output: 0,
          provider: 'vercel-ai-gateway',
        },
      ],
    });
  } finally {
    await disconnect();
  }
});

test('image generation reports gateway errors and stops at the spend limit', async () => {
  const headers = await signIn();

  stubGateway(
    new Response(null, { status: 401 }),
    Response.json({ error: { message: 'foo' } }, { status: 400 }),
    new Response('foo', { status: 500 }),
    Response.json({ choices: [{ message: { content: 'bar' } }] }),
    image({ completion_tokens: 0, cost: 0.04, prompt_tokens: 0 })
  );

  await connect();

  env.LAB_MONTHLY_LIMIT = 0.01;

  try {
    script(
      generate(),
      generate(),
      generate(),
      generate(),
      generate({ images: [1_000_000] }),
      generate(),
      generate(),
      fauxAssistantMessage('baz')
    );

    const id = await chat(headers, { content: 'foo' });

    const saved = await latestLibraryId(headers);

    expect(await toolOutputs(headers, id)).toEqual([
      'The Vercel AI Gateway rejected the API key. The user can update it in Settings → Providers.',
      'Image generation failed (400): foo',
      'Image generation failed (500).',
      'The image model returned no image: bar',
      'No library image has the id 1000000.',
      `Saved foo.png to the library as id ${saved}.`,
      'You’ve used this month’s $0.01 limit',
    ]);
  } finally {
    env.LAB_MONTHLY_LIMIT = undefined;
    await disconnect();
  }
});

test('stopping a chat cancels its image generation', async () => {
  const headers = await signIn();

  await connect();

  const started = Promise.withResolvers<AbortSignal | null | undefined>();

  spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(
      (_input: string | Request | URL, init?: RequestInit) => {
        started.resolve(init?.signal);

        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason)
          );
        });
      },
      { preconnect: fetch.preconnect }
    )
  );

  try {
    script(generate(), fauxAssistantMessage('baz'));

    const { body } = await call(headers, 'POST', '/conversations', {
      content: 'foo',
    });

    const signal = await started.promise;

    const stopped = call(headers, 'POST', `/conversations/${body.id}/abort`);

    expect(
      await Promise.race([
        stopped.then(({ status }) => status),
        Bun.sleep(1_000).then(() => 'still running'),
      ])
    ).toBe(204);

    await settle(body.id);

    expect({
      aborted: signal?.aborted,
      outputs: await toolOutputs(headers, body.id),
    }).toEqual({
      aborted: true,
      outputs: [
        '<harness>\n[error] Tool image_generate was aborted\n</harness>',
      ],
    });
  } finally {
    await disconnect();
  }
});
