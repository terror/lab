import { TextDecoder } from "node:util";
import type { Context, JsonValue } from "@earendil-works/chord";
import type { ToolExecutionResult } from "@earendil-works/pi-durable";

export function toolSignal(context: Context) {
  return AbortSignal.any([
    AbortSignal.timeout(60_000),
    ...(context.abortSignal === undefined ? [] : [context.abortSignal]),
  ]);
}

export async function fetchText(input: string | URL, signal: AbortSignal) {
  let url = new URL(input);
  const headers = new Headers({ "User-Agent": "lab" });

  for (let redirects = 0; redirects <= 5; redirects += 1) {
    signal.throwIfAborted();

    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username !== "" ||
      url.password !== ""
    ) {
      throw new Error("Use an HTTP or HTTPS URL without embedded credentials.");
    }

    const response = await fetch(url, {
      signal,
      headers,
      redirect: "manual",
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get("location");

      if (location === null) {
        throw new Error(`Redirect from ${url.hostname} has no destination.`);
      }

      const next = new URL(location, url);

      if (url.protocol === "https:" && next.protocol !== "https:") {
        throw new Error("Refusing an HTTPS redirect to an insecure URL.");
      }

      url = next;
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(
        `HTTP ${response.status} from ${url.hostname}${
          response.status === 429 || response.status === 403
            ? "; access may be denied or rate limited"
            : ""
        }.`,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    const text = await readText(response, 2_000_000);
    return { url: url.href, contentType, text };
  }

  throw new Error("Too many HTTP redirects.");
}

export function toolResult(value: JsonValue): ToolExecutionResult {
  return {
    output: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredOutput: value,
    details: value,
  };
}

async function readText(response: Response, maxBytes: number) {
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body?.cancel();
    throw new Error(`Response exceeds the ${maxBytes}-byte download limit.`);
  }

  const reader = response.body?.getReader();

  if (reader === undefined) {
    return "";
  }

  try {
    const charset = /charset\s*=\s*["']?([^\s;"']+)/i.exec(
      response.headers.get("content-type") ?? "",
    )?.[1];
    const decoder = new TextDecoder(charset ?? "utf-8", { fatal: true });
    let bytes = 0;
    let text = "";

    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        return text + decoder.decode();
      }

      bytes += value.byteLength;

      if (bytes > maxBytes) {
        throw new Error(
          `Response exceeds the ${maxBytes}-byte download limit.`,
        );
      }

      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
