export type ToolResource =
  | 'connectors'
  | 'conversations'
  | 'library'
  | 'memory'
  | 'preferences'
  | 'projects'
  | 'schedules'
  | 'skills'
  | 'trash';

export const toolWrites = {
  artifact_create: [],
  artifact_read: [],
  artifact_state_read: [],
  artifact_update: [],
  ask_user: [],
  chat_delete: ['conversations', 'trash'],
  chat_move: ['conversations'],
  chat_pin: ['conversations'],
  chat_read: [],
  chat_rename: ['conversations'],
  chat_search: [],
  codemode: [],
  connector_add: ['connectors'],
  connector_list: [],
  connector_remove: ['connectors'],
  connector_update: ['connectors'],
  delegate: [],
  forget: ['memory'],
  image_generate: ['library'],
  library_read: [],
  library_search: [],
  plan_update: [],
  preferences_update: ['preferences'],
  project_create: ['projects'],
  project_delete: ['conversations', 'projects', 'trash'],
  project_list: [],
  project_update: ['projects'],
  remember: ['memory'],
  sandbox_exec: [],
  sandbox_list: [],
  sandbox_read: [],
  sandbox_save: ['library'],
  sandbox_upload: [],
  sandbox_write: [],
  schedule_create: ['schedules'],
  schedule_delete: ['schedules'],
  schedule_list: [],
  schedule_update: ['schedules'],
  skill_create: ['skills'],
  skill_delete: ['skills'],
  skill_read: [],
  skill_update: ['skills'],
  tool_output_read: [],
  trash_list: [],
  trash_purge: ['conversations', 'projects', 'trash'],
  trash_restore: ['conversations', 'projects', 'trash'],
  web_fetch: [],
  web_search: [],
} satisfies Record<string, readonly ToolResource[]>;

export type ToolName = keyof typeof toolWrites;

export const toolNames = Object.keys(toolWrites);
