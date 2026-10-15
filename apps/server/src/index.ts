const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(Bun.env.PORT ?? 3000),
  routes: {
    "/health": Response.json({ status: "ok" }),
  },
  fetch() {
    return new Response("Not found", { status: 404 });
  },
});

console.info(`Lab service listening on ${server.url}`);
