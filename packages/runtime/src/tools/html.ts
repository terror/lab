import { parseHTML } from "linkedom";

export function htmlText(html: string) {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);

  for (const node of document.querySelectorAll(
    "script, style, noscript, template, svg, nav, header, footer",
  )) {
    node.remove();
  }

  for (const node of document.querySelectorAll("br")) {
    node.replaceWith("\n");
  }

  for (const node of document.querySelectorAll(
    "p, div, li, pre, blockquote, h1, h2, h3, h4, h5, h6, tr",
  )) {
    node.append("\n");
  }

  return (document.body.textContent ?? "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
