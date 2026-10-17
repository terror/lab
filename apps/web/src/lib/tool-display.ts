import type { ToolProgress } from "@lab/wire";
import { Globe, type LucideIcon, Wrench } from "lucide-react";
import { Guard } from "typebox/guard";

type ToolDisplay = {
  icon: LucideIcon;
  label: string;
  statusLabels?: Partial<Record<ToolProgress["status"], string>>;
  subject?: string | undefined;
  url?: URL | undefined;
  resultPreview?: string | undefined;
};

export function describeTool(call: ToolProgress) {
  const display = toolDisplay(call);

  const presentation = {
    icon: display.icon,
    label: display.statusLabels?.[call.status] ?? display.label,
    subject: display.subject,
    url: display.url,
  };

  switch (call.status) {
    case "failed":
      return {
        ...presentation,
        preview: call.output.trim().split("\n")[0]?.slice(0, 240),
      };
    case "pending":
    case "running":
      return {
        ...presentation,
        preview: call.output.trim().split("\n").at(-1)?.slice(0, 240),
      };
    case "succeeded":
      return { ...presentation, preview: display.resultPreview };
    case "interrupted":
      return { ...presentation, preview: undefined };
  }
}

function toolDisplay(call: ToolProgress): ToolDisplay {
  switch (call.name) {
    case "web_search": {
      const parsed = URL.parse(
        getStringField(call.details, "url") ??
          getStringField(call.arguments, "url") ??
          "",
      );

      const url =
        parsed?.protocol === "https:" || parsed?.protocol === "http:"
          ? parsed
          : undefined;

      return {
        icon: Globe,
        label: "Read webpage",
        statusLabels: { running: "Reading webpage" },
        subject: url?.hostname.replace(/^www\./, ""),
        url,
        resultPreview: getStringField(call.details, "title"),
      };
    }
    default: {
      const name = call.name.replace(/[_.-]+/g, " ");

      return {
        icon: Wrench,
        label: name.charAt(0).toUpperCase() + name.slice(1),
        statusLabels: {
          running: `Running ${name}`,
          succeeded: `Used ${name}`,
        },
      };
    }
  }
}

function getStringField(value: unknown, key: string): string | undefined {
  if (!Guard.IsObjectNotArray(value)) {
    return;
  }

  const text = value[key];

  if (!Guard.IsString(text)) {
    return;
  }

  return text.trim() || undefined;
}
