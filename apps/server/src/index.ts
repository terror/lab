import { homedir } from "node:os";
import { join } from "node:path";
import {
  BACKGROUND_CONTEXT,
  withAbortSignal,
} from "@earendil-works/chord/context";
import { createBuiltinTools, openRuntime } from "@lab/runtime";
import { loadDefaultModel, loadModels } from "./models";
import { serve } from "./server";

async function main() {
  const password = Bun.env.LAB_PASSWORD;

  if (password === undefined || password.length === 0) {
    throw new Error("LAB_PASSWORD must be configured");
  }

  const port = Number(Bun.env.PORT ?? 3000);
  const shutdown = new AbortController();

  const stop = () => shutdown.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    const model =
      Bun.env.LAB_MODEL === undefined
        ? undefined
        : {
            provider: Bun.env.LAB_PROVIDER ?? "openai",
            modelId: Bun.env.LAB_MODEL,
          };

    const defaultModel = model === undefined ? loadDefaultModel() : undefined;

    const owner = await openRuntime(
      {
        path:
          Bun.env.LAB_DATA_PATH ??
          join(homedir(), ".local", "share", "lab", "lab.sqlite"),
        ...(model === undefined ? {} : { model }),
        ...(defaultModel === undefined ? {} : { defaultModel }),
        extensions: [createBuiltinTools()],
        ...(Bun.env.LAB_EXTENSION_MODULES === undefined
          ? {}
          : { extensionModules: JSON.parse(Bun.env.LAB_EXTENSION_MODULES) }),
        models: await loadModels(shutdown.signal, {
          ...(Bun.env.LAB_MODELS_PATH === undefined
            ? {}
            : { modelsPath: Bun.env.LAB_MODELS_PATH }),
          ...(Bun.env.LAB_AUTH_PATH === undefined
            ? {}
            : { authPath: Bun.env.LAB_AUTH_PATH }),
          ...(Bun.env.LAB_PROVIDER_MODULE === undefined
            ? {}
            : { providerModule: Bun.env.LAB_PROVIDER_MODULE }),
        }),
        onReport: (error) => console.error("Lab runtime error:", error),
      },
      withAbortSignal(shutdown.signal, BACKGROUND_CONTEXT),
    );

    try {
      shutdown.signal.throwIfAborted();

      const stopped = new Promise<void>((resolve) => {
        shutdown.signal.addEventListener("abort", () => resolve(), {
          once: true,
        });
      });

      const server = await serve(owner.runtime, {
        port,
        authentication: {
          password,
          origin: Bun.env.LAB_ORIGIN ?? `http://127.0.0.1:${port}`,
        },
      });

      try {
        console.info(`Lab service listening on ${server.url}`);
        await Promise.race([stopped, owner.closed]);
      } finally {
        await server.close();
      }
    } finally {
      await owner.close(BACKGROUND_CONTEXT);
    }

    const end = await owner.closed;

    if (end.reason === "failed") {
      throw end.error;
    }
  } catch (error) {
    if (error !== shutdown.signal.reason) {
      throw error;
    }
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}

try {
  await main();
} catch (error) {
  console.error("Lab service failed:", error);
  process.exitCode = 1;
}
