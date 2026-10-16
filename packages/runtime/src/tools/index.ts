import { defineExtension } from "@earendil-works/pi-durable";
import { WebSearch } from "./web-search";

export const BuiltinExtension = defineExtension({
  name: "lab.tools",
  tools: [WebSearch],
});
