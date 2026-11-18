import { z } from 'zod';

import { call, client } from './client';

type Method = (args: unknown, active: boolean) => Promise<unknown>;

function method<T>(
  schema: z.ZodType<T>,
  run: (args: T, active: boolean) => Promise<unknown>
): Method {
  return async (args, active) => run(schema.parse(args), active);
}

const keyed = z.object({ key: z.string() });

export function artifactCalls(conversationId: number, artifactId: string) {
  const param = { artifactId, id: String(conversationId) };

  const artifact = client.conversations[':id'].artifacts[':artifactId'];

  let saving = Promise.resolve<unknown>(undefined);

  const inOrder = (run: () => Promise<unknown>) => {
    const next = saving.then(run);

    saving = next.catch(() => undefined);

    return next;
  };

  const methods = new Map<string, Method>([
    [
      'ask',
      method(z.object({ prompt: z.string() }), async ({ prompt }, active) => {
        if (!active) {
          throw new Error(
            'lab.ask needs a click or key press in the artifact.'
          );
        }

        return (await call(artifact.ask.$post({ json: { prompt }, param })))
          .text;
      }),
    ],
    [
      'store.delete',
      method(keyed, ({ key }) =>
        inOrder(() => call(artifact.state.$delete({ param, query: { key } })))
      ),
    ],
    [
      'store.get',
      method(keyed, ({ key }) =>
        inOrder(
          async () =>
            (await call(artifact.state.$get({ param, query: { key } }))).value
        )
      ),
    ],
    [
      'store.set',
      method(keyed.extend({ value: z.string() }), ({ key, value }) =>
        inOrder(() =>
          call(artifact.state.$put({ json: { value }, param, query: { key } }))
        )
      ),
    ],
  ]);

  return async (name: string, args: unknown, active: boolean) => {
    const run = methods.get(name);

    if (!run) {
      throw new Error(`lab.${name} isn’t available.`);
    }

    return run(args, active);
  };
}
