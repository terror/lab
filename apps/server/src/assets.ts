import { extname, join } from "node:path";
import type { BunFile } from "bun";

export async function staticAssets(directory: string) {
  const files = new Map<string, BunFile>();

  if (await Bun.file(join(directory, "index.html")).exists()) {
    for await (const path of new Bun.Glob("**/*").scan({
      cwd: directory,
      onlyFiles: true,
      followSymlinks: false,
    })) {
      files.set(`/${path}`, Bun.file(join(directory, path)));
    }
  }

  return (request: Request): Response => {
    const path = decodeURIComponent(new URL(request.url).pathname);
    const file =
      files.get(path) ??
      (path === "/" ||
      (!path.startsWith("/assets/") &&
        extname(path) === "" &&
        request.headers.get("accept")?.includes("text/html"))
        ? files.get("/index.html")
        : undefined);

    if (file === undefined) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(request.method === "HEAD" ? null : file, {
      headers: {
        "Content-Type": file.type,
        "Content-Length": String(file.size),
        "Cache-Control": path.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      },
    });
  };
}
