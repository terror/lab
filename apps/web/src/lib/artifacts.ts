import { z } from 'zod';

import { call, client } from './client';

type Method = (args: unknown) => Promise<unknown>;

function method<T>(
  schema: z.ZodType<T>,
  run: (args: T) => Promise<unknown>
): Method {
  return async (args) => run(schema.parse(args));
}

const keyed = z.object({ key: z.string() });

export function artifactCalls(conversationId: number, artifactId: string) {
  const param = { artifactId, id: String(conversationId) };

  const state = client.conversations[':id'].artifacts[':artifactId'].state;

  let saving = Promise.resolve<unknown>(undefined);

  const inOrder = (run: () => Promise<unknown>) => {
    const next = saving.then(run);

    saving = next.catch(() => undefined);

    return next;
  };

  const methods = new Map<string, Method>([
    [
      'store.delete',
      method(keyed, ({ key }) =>
        inOrder(() => call(state.$delete({ param, query: { key } })))
      ),
    ],
    [
      'store.get',
      method(keyed, ({ key }) =>
        inOrder(
          async () => (await call(state.$get({ param, query: { key } }))).value
        )
      ),
    ],
    [
      'store.set',
      method(keyed.extend({ value: z.string() }), ({ key, value }) =>
        inOrder(() =>
          call(state.$put({ json: { value }, param, query: { key } }))
        )
      ),
    ],
  ]);

  return async (name: string, args: unknown) => {
    const run = methods.get(name);

    if (!run) {
      throw new Error(`lab.${name} isn’t available.`);
    }

    return run(args);
  };
}
