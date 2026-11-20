export const TOOL_ERROR_KINDS = [
  'aborted',
  'blocked',
  'failed',
  'interrupted',
  'invalid',
  'unavailable',
] as const;

export type ToolErrorKind = (typeof TOOL_ERROR_KINDS)[number];

export type ToolIssue = {
  keyword: string;
  message: string;
  path: (number | string)[];
};

export type ToolError = {
  issues: ToolIssue[];
  kind: ToolErrorKind;
  message: string;
};
