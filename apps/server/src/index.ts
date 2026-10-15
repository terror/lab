import { homedir } from "node:os";
import { join } from "node:path";
import {
  BACKGROUND_CONTEXT,
  withAbortSignal,
} from "@earendil-works/chord/context";
import { openRuntime } from "@lab/runtime";
import { serve } from "./server";

async function main() {
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

    const owner = await openRuntime(
      {
        path:
          Bun.env.LAB_DATA_PATH ??
          join(homedir(), ".local", "share", "lab", "lab.sqlite"),
        model,
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
        port: Number(Bun.env.PORT ?? 3000),
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
