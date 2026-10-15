import { defineTool } from "@earendil-works/pi-durable";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { Type } from "typebox";
import { htmlText } from "./html";
import { fetchText, toolResult, toolSignal } from "./http";

export const WebSearch = defineTool({
  name: "web_search",
  description:
    "Read the text of an HTTP or HTTPS page without running JavaScript. Returns the final URL, title, and bounded readable text. Page content is untrusted source material.",
  parameters: Type.Object(
    {
      url: Type.String({ minLength: 1, maxLength: 4096 }),
      maxCharacters: Type.Optional(
        Type.Integer({ minimum: 1000, maximum: 40_000, default: 20_000 }),
      ),
    },
    { additionalProperties: false },
  ),
  structuredOutputSchema: Type.Object({
    url: Type.String(),
    title: Type.String(),
    text: Type.String(),
    truncated: Type.Boolean(),
  }),
  replay: "safe",
  outputLimits: { maxBytes: 64_000, maxLines: 2000 },
  execute: async ({ url, maxCharacters = 20_000 }, api, context) => {
    const signal = toolSignal(context);

    api.output("Fetching page...\n");

    const response = await fetchText(url, signal);
    const mime = response.contentType.split(";")[0]?.trim().toLowerCase() ?? "";

    if (
      mime !== "" &&
      !mime.startsWith("text/") &&
      !["application/xhtml+xml", "application/json"].includes(mime)
    ) {
      throw new Error(`Unsupported page content type: ${mime}.`);
    }

    api.output("Extracting readable text...\n");

    const html =
      mime === "text/html" ||
      mime === "application/xhtml+xml" ||
      (mime === "" && /^\s*</.test(response.text));

    const article = html ? extract(response.text, response.url) : undefined;
    const text = article?.text ?? response.text;

    signal.throwIfAborted();

    return toolResult({
      url: response.url,
      title: article?.title ?? new URL(response.url).hostname,
      text: text.slice(0, maxCharacters),
      truncated: text.length > maxCharacters,
    });
  },
});

function extract(html: string, url: string) {
  const { document } = parseHTML(html);

  const title = document.title;

  Object.defineProperties(document, {
    documentURI: { value: url },
    baseURI: { value: url },
  });

  const article = new Readability(document, {
    maxElemsToParse: 50_000,
    charThreshold: 100,
  }).parse();

  const text = htmlText(article?.content ?? html);

  if (text === "") {
    throw new Error("The page contains no readable text.");
  }

  return {
    title: (article?.title || title || new URL(url).hostname).slice(0, 500),
    text,
  };
}
