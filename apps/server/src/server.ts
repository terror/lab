import { fileURLToPath } from "node:url";
import type { Runtime } from "@lab/runtime";
import { staticAssets } from "./assets";
import { Sessions } from "./auth";
import { createLabHost } from "./chord";
import { webSockets } from "./websocket";

export async function serve(
  runtime: Runtime,
  options: {
    port: number;
    assets?: string;
    authentication: { origin: string; password: string };
  },
) {
  const assets = await staticAssets(
    options.assets ??
      fileURLToPath(new URL("../../web/dist/", import.meta.url)),
  );

  const sessions = await Sessions.open(options.authentication, (principal) =>
    host.invalidatePrincipal(principal),
  );
  const host = createLabHost(runtime, sessions);

  try {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: options.port,
      maxRequestBodySize: 8192,
      websocket: webSockets(host, sessions),
      fetch(request, server) {
        const path = new URL(request.url).pathname;

        if (path === "/auth/session") {
          return sessions.handle(request);
        }

        if (path === "/chord") {
          if (!sessions.allows(request, true)) {
            return new Response("Forbidden", { status: 403 });
          }

          if (request.method !== "GET") {
            return new Response("Method not allowed", {
              status: 405,
              headers: { Allow: "GET" },
            });
          }

          const principal = sessions.principal(request);

          if (principal === undefined) {
            return new Response("Unauthorized", {
              status: 401,
              headers: { "Cache-Control": "no-store" },
            });
          }

          return server.upgrade(request, { data: { principal } })
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
        sessions.close();
        const stopped = server.stop(true);

        try {
          await host.close();
        } finally {
          await stopped;
        }
      },
    };
  } catch (error) {
    sessions.close();
    await host.close();
    throw error;
  }
}
