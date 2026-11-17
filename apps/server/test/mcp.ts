import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

async function handleMcp(request: Request) {
  const mcp = new McpServer({ name: 'foo', version: '1.0.0' });

  mcp.registerTool(
    'read',
    {
      annotations: { readOnlyHint: true },
      description: 'bar',
      inputSchema: { value: z.string() },
    },
    async ({ value }) => ({
      content: [{ text: `read ${value}`, type: 'text' }],
    })
  );

  mcp.registerTool(
    'write',
    { description: 'baz', inputSchema: { value: z.string() } },
    async ({ value }) => ({
      content: [{ text: `wrote ${value}`, type: 'text' }],
    })
  );

  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined,
  });

  await mcp.connect(transport);

  return transport.handleRequest(request);
}

export function serveMcp() {
  const server = Bun.serve({
    fetch: handleMcp,
    hostname: '127.0.0.1',
    port: 0,
  });

  return { stop: () => server.stop(true), url: `${server.url.href}mcp` };
}

async function protectedMcp(request: Request) {
  const { origin, pathname } = new URL(request.url);

  const routes: Record<string, () => Promise<Response> | Response> = {
    '/.well-known/oauth-authorization-server': () =>
      Response.json({
        authorization_endpoint: `${origin}/authorize`,
        code_challenge_methods_supported: ['S256'],
        issuer: origin,
        registration_endpoint: `${origin}/register`,
        response_types_supported: ['code'],
        token_endpoint: `${origin}/token`,
      }),
    '/.well-known/oauth-protected-resource/mcp': () =>
      Response.json({
        authorization_servers: [origin],
        resource: `${origin}/mcp`,
      }),
    '/register': async () =>
      Response.json(
        {
          ...z.record(z.string(), z.unknown()).parse(await request.json()),
          client_id: 'foo',
        },
        { status: 201 }
      ),
    '/token': () =>
      Response.json({ access_token: 'bar', token_type: 'Bearer' }),
  };

  const route = routes[pathname];

  if (route) {
    return route();
  }

  if (request.headers.get('authorization') !== 'Bearer bar') {
    return new Response(null, {
      headers: {
        'www-authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`,
      },
      status: 401,
    });
  }

  return handleMcp(request);
}

export function serveProtectedMcp() {
  const server = Bun.serve({
    fetch: protectedMcp,
    hostname: '127.0.0.1',
    port: 0,
  });

  return { stop: () => server.stop(true), url: `${server.url.href}mcp` };
}
