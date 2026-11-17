import type { generateSpecs } from 'hono-openapi';

type Specs = Awaited<ReturnType<typeof generateSpecs>>;

export function errorResponse(description: string) {
  return {
    content: {
      'application/json': {
        schema: {
          properties: { error: { type: 'string' as const } },
          required: ['error'],
          type: 'object' as const,
        },
      },
    },
    description,
  };
}

export const errorResponses = {
  401: errorResponse('Not signed in'),
  404: errorResponse('Not found'),
};

function resource(path: string) {
  const segment = path.split('/')[2] ?? 'api';

  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function tagByResource(specs: Specs): Specs {
  const paths = Object.fromEntries(
    Object.entries(specs.paths ?? {}).map(([path, item]) => [
      path,
      Object.fromEntries(
        Object.entries(item ?? {}).map(([method, operation]) => [
          method,
          typeof operation === 'object' &&
          operation !== null &&
          !Array.isArray(operation)
            ? { ...operation, tags: [resource(path)] }
            : operation,
        ])
      ),
    ])
  );

  const tags = [...new Set(Object.keys(paths).map(resource))]
    .toSorted()
    .map((name) => ({ name }));

  return { ...specs, paths, tags };
}
