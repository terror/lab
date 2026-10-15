import { fileURLToPath } from "node:url";
import type { Runtime } from "@lab/runtime";
import { staticAssets } from "./assets";
import { createLabHost } from "./chord";
import { webSockets } from "./websocket";

export async function serve(
  runtime: Runtime,
  options: { port: number; assets?: string },
) {
  const assets = await staticAssets(
    options.assets ??
      fileURLToPath(new URL("../../web/dist/", import.meta.url)),
  );

  const host = createLabHost(runtime);

  try {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: options.port,
      websocket: webSockets(host),
      fetch(request, server) {
        const path = new URL(request.url).pathname;

        if (path === "/chord") {
          if (request.method !== "GET") {
            return new Response("Method not allowed", {
              status: 405,
              headers: { Allow: "GET" },
            });
          }

          return server.upgrade(request, { data: {} })
            ? undefined
            : new Response("WebSocket upgrade required", {
                status: 426,
                headers: { Upgrade: "websocket" },
              });
        }

        if (request.method !== "GET" && request.method !== "HEAD") {
          return new Response("Method not allowed", {
            status: 405,
            headers: { Allow: "GET, HEAD" },
          });
        }

        if (path === "/health") {
          return request.method === "HEAD"
            ? new Response(null, {
                headers: { "Content-Type": "application/json" },
              })
            : Response.json({ status: "ok" });
        }

        try {
          return assets(request);
        } catch (error) {
          if (error instanceof URIError) {
            return new Response("Invalid path", { status: 400 });
          }

          throw error;
        }
      },
    });

    return {
      url: server.url,
      close: async () => {
        const stopped = server.stop(true);

        try {
          await host.close();
        } finally {
          await stopped;
        }
      },
    };
  } catch (error) {
    await host.close();
    throw error;
  }
}
