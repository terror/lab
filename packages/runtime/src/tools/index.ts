import { defineExtension } from "@earendil-works/pi-durable";
import { WebSearch } from "./web-search";

export function createBuiltinTools() {
  return defineExtension({
    name: "lab.tools",
    tools: [WebSearch],
  });
}
