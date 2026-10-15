import { isBuiltin } from "node:module";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, normalizePath, type Plugin } from "vite";

const backendDirectories = ["../server/", "../../packages/runtime/"].map(
  (path) => normalizePath(fileURLToPath(new URL(path, import.meta.url))),
);

function browserBoundary(): Plugin {
  return {
    name: "lab-browser-boundary",
    enforce: "pre",
    resolveId(source) {
      if (
        isBuiltin(source) ||
        source.startsWith("node:") ||
        source === "bun" ||
        source.startsWith("bun:") ||
        /^@lab\/(server|runtime)(\/|$)/.test(source) ||
        /^@earendil-works\/pi-(ai|durable|codemode)(\/|$)/.test(source) ||
        source === "@earendil-works/chord/node"
      ) {
        this.error(
          `Backend-only import is not allowed in the browser: ${source}`,
        );
      }
    },
    load(id) {
      if (
        backendDirectories.some((directory) =>
          normalizePath(id).startsWith(directory),
        )
      ) {
        this.error(`Backend-only module is not allowed in the browser: ${id}`);
      }
    },
  };
}

export default defineConfig({
  plugins: [browserBoundary(), react(), tailwindcss()],
  optimizeDeps: {
    rolldownOptions: {
      plugins: [browserBoundary()],
    },
  },
  worker: {
    plugins: () => [browserBoundary()],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    cors: false,
    headers: {
      "Content-Security-Policy":
        "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    },
    proxy: {
      "/auth/session": {
        target: `http://127.0.0.1:${process.env.PORT ?? 3000}`,
        changeOrigin: false,
      },
      "/chord": {
        target: `http://127.0.0.1:${process.env.PORT ?? 3000}`,
        changeOrigin: false,
        rewriteWsOrigin: false,
        ws: true,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
  },
});
