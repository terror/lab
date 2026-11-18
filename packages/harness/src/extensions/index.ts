import type { Extension } from '@earendil-works/pi-durable';

import type { HelperUsage } from '../helper';
import { type ArtifactStateAccess, artifactApps } from './artifact-apps';
import { artifacts } from './artifacts';
import { ask } from './ask';
import { assistant } from './assistant';
import { type ChatsAccess, chats } from './chats';
import { codemode } from './codemode';
import { compaction } from './compaction';
import { type ConnectorAccess, connectorSettings } from './connector-settings';
import { type Admit, delegate } from './delegate';
import { type HistoryAccess, history } from './history';
import { type ImageAccess, images } from './images';
import { type LibraryAccess, library } from './library';
import { memory } from './memory';
import { limitOutput, output } from './output';
import { plan } from './plan';
import { preferences } from './preferences';
import { type ProjectAccess, project } from './project';
import { type SandboxAccess, sandbox } from './sandbox';
import { type ScheduleAccess, schedule } from './schedule';
import { skills } from './skills';
import { title } from './title';
import type { Owner } from './users';
import { type WebAccess, web } from './web';

export {
  type ArtifactStateAccess,
  STORE_KEY_LENGTH,
  STORE_KEY_LIMIT,
  STORE_VALUE_LENGTH,
} from './artifact-apps';
export { type Artifact, ArtifactsDoc } from './artifacts';
export {
  type ConnectorAccess,
  type ConnectorChange,
  type ConnectorSummary,
} from './connector-settings';
export {
  type Connector,
  type ConnectorResult,
  type ConnectorTool,
  connectorsExtension,
  connectorToolName,
} from './connector';
export {
  type ChatMatch,
  type ChatTranscript,
  type HistoryAccess,
} from './history';
export { type ImageAccess } from './images';
export {
  type LibraryAccess,
  type LibraryContent,
  type LibraryEntry,
  READ_LENGTH,
  library,
} from './library';
export { MEMORY_LENGTH, MEMORY_LIMIT, MemoryDoc, memory } from './memory';
export {
  SKILL_DESCRIPTION_LENGTH,
  SKILL_INSTRUCTIONS_LENGTH,
  SKILL_LIMIT,
  SKILL_NAME_LENGTH,
  type Skill,
  type SkillChange,
  SkillsDoc,
  createSkill,
  deleteSkill,
  skills,
  updateSkill,
} from './skills';
export {
  ANSWER_LENGTH,
  APPROVED,
  type ApprovalRequest,
  DENIED,
  QuestionsDoc,
  requestApproval,
} from './host-input';
export {
  ComputerDoc,
  type NetworkMode,
  SANDBOX_OUTPUT_LENGTH,
  networkModes,
  type SandboxAccess,
  type SandboxCommand,
  type SandboxFile,
  type SandboxRun,
  type SandboxWrite,
  type SavedFile,
} from './sandbox';
export {
  PROJECT_INSTRUCTIONS_LENGTH,
  PROJECT_NAME_LENGTH,
  type Project,
  type ProjectAccess,
  type ProjectChange,
} from './project';
export {
  ProfileDoc,
  type ScheduleAccess,
  type ScheduleChange,
  type ScheduleInput,
  type ScheduleUpdate,
  type ScheduledTask,
} from './schedule';
export {
  type ChatSummary,
  type ChatsAccess,
  type TrashEntry,
  type TrashKind,
  trashKinds,
} from './chats';
export { PlanDoc, editPlan } from './plan';
export { PreferencesDoc } from './preferences';
export { type Owner, userDoc } from './users';
export { TitleDoc, plainTitle, titleChat } from './title';
export {
  type WebAccess,
  type WebPage,
  type WebRecency,
  type WebResult,
  type WebSearch,
} from './web';

export type ExtensionDeps = {
  admit: Admit;
  artifactState: ArtifactStateAccess;
  chats: ChatsAccess;
  connectors: ConnectorAccess;
  owner: Owner;
  history: HistoryAccess;
  images: ImageAccess;
  library: LibraryAccess;
  onHelperUsage: HelperUsage;
  project: ProjectAccess;
  sandbox: SandboxAccess;
  schedule: ScheduleAccess;
  web: WebAccess;
};

const outputLimits = {
  maxBytes: 4 * 1024 * 1024,
  maxLines: Number.MAX_SAFE_INTEGER,
};

function ownLimits(extension: Extension): Extension {
  return {
    ...extension,
    tools: extension.tools?.map((tool) => ({
      ...tool,
      execute: async (args, api, context) =>
        limitOutput(await tool.execute(args, api, context), api, context),
      outputLimits,
    })),
  };
}

export function extensions(deps: ExtensionDeps) {
  return [
    artifacts,
    artifactApps(deps.artifactState),
    ask,
    assistant,
    chats(deps.chats),
    codemode,
    connectorSettings(deps.connectors),
    output,
    plan,
    preferences(deps.owner),
    compaction(deps.onHelperUsage),
    history(deps.history, deps.owner),
    images(deps.images),
    library(deps.library),
    memory(deps.owner),
    project(deps.project),
    sandbox(deps.sandbox, deps.owner),
    schedule(deps.schedule, deps.owner),
    skills(deps.owner),
    title(deps.onHelperUsage),
    web(deps.web),
    delegate(deps.admit),
  ].map(ownLimits);
}
