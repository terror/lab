import type { HelperUsage } from '../helper';
import { ask } from './ask';
import { assistant } from './assistant';
import { codemode } from './codemode';
import { compaction } from './compaction';
import { type HistoryAccess, history } from './history';
import { type LibraryAccess, library } from './library';
import { memory } from './memory';
import { type SandboxAccess, sandbox } from './sandbox';
import { skills } from './skills';
import { title } from './title';
import { type WebAccess, web } from './web';

export {
  type ChatMatch,
  type ChatTranscript,
  type HistoryAccess,
} from './history';
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
export { ANSWER_LENGTH, QuestionsDoc } from './ask';
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
export { TitleDoc } from './title';
export {
  type WebAccess,
  WebDoc,
  type WebPage,
  type WebRecency,
  type WebResult,
  type WebSearch,
  normalizeUrl,
} from './web';

export type ExtensionDeps = {
  history: HistoryAccess;
  library: LibraryAccess;
  onHelperUsage: HelperUsage;
  sandbox: SandboxAccess;
  web: WebAccess;
};

export function extensions(deps: ExtensionDeps) {
  return [
    ask,
    assistant,
    codemode,
    compaction(deps.onHelperUsage),
    history(deps.history),
    library(deps.library),
    memory,
    sandbox(deps.sandbox),
    skills,
    title(deps.onHelperUsage),
    web(deps.web),
  ];
}
