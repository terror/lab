import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

export function serveMcp() {
  const server = Bun.serve({
    fetch: async (request) => {
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
    },
    hostname: '127.0.0.1',
    port: 0,
  });

  return { stop: () => server.stop(true), url: `${server.url.href}mcp` };
}
