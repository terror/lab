import app from '../src/app';

export async function call(
  headers: Headers,
  method: string,
  path: string,
  body?: unknown
) {
  const response = await app.request(`/api${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      ...Object.fromEntries(headers),
      'content-type': 'application/json',
    },
    method,
  });

  const text = await response.text();

  return { body: text ? JSON.parse(text) : null, status: response.status };
}
