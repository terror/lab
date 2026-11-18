import {
  defineExtension,
  defineTool,
  section,
} from '@earendil-works/pi-durable';
import { obj, opt, str } from '@earendil-works/pi-schema';
import { randomUUID } from 'node:crypto';

import { type Owner, userDoc } from './docs';
import { type ApprovalRequest, requestApproval } from './host-input';
import { failure, text } from './results';

export const SKILL_LIMIT = 50;

export const SKILL_NAME_LENGTH = 64;

export const SKILL_DESCRIPTION_LENGTH = 300;

export const SKILL_INSTRUCTIONS_LENGTH = 20_000;

export type Skill = {
  createdAt: number;
  description: string;
  id: string;
  instructions: string;
  name: string;
  updatedAt: number;
};

type SkillsState = { skills: Skill[] };

type SkillFields = Pick<Skill, 'description' | 'instructions' | 'name'>;

export type SkillChange =
  | { kind: 'duplicate' }
  | { kind: 'full' }
  | { kind: 'missing' }
  | { kind: 'saved'; skill: Skill };

export const SkillsDoc = userDoc<SkillsState>('lab.user.skills', () => ({
  skills: [],
}));

function taken(state: SkillsState, name: string, except?: string) {
  const key = name.trim().toLowerCase();

  return state.skills.some(
    (skill) => skill.id !== except && skill.name.trim().toLowerCase() === key
  );
}

export function createSkill(
  state: SkillsState,
  { id, now, ...fields }: SkillFields & { id: string; now: number }
): SkillChange {
  const existing = state.skills.find((skill) => skill.id === id);

  if (existing) {
    return { kind: 'saved', skill: { ...existing } };
  }

  if (state.skills.length >= SKILL_LIMIT) {
    return { kind: 'full' };
  }

  if (taken(state, fields.name)) {
    return { kind: 'duplicate' };
  }

  const skill = { ...fields, createdAt: now, id, updatedAt: now };

  state.skills.push(skill);

  return { kind: 'saved', skill };
}

export function updateSkill(
  state: SkillsState,
  { id, now, ...fields }: Partial<SkillFields> & { id: string; now: number }
): SkillChange {
  const skill = state.skills.find((entry) => entry.id === id);

  if (!skill) {
    return { kind: 'missing' };
  }

  if (fields.name !== undefined && taken(state, fields.name, id)) {
    return { kind: 'duplicate' };
  }

  Object.assign(
    skill,
    Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined)
    ),
    { updatedAt: now }
  );

  return { kind: 'saved', skill: { ...skill } };
}

export function deleteSkill(state: SkillsState, id: string) {
  const index = state.skills.findIndex((skill) => skill.id === id);

  const removed = index < 0 ? undefined : state.skills.splice(index, 1)[0];

  return removed && { ...removed };
}

const failures = {
  duplicate: 'A skill with that name already exists. Pick another name.',
  full: `Skills are full (${SKILL_LIMIT}). Ask the user which skill to delete.`,
  missing: 'No skill has that id.',
};

const notes = {
  Created:
    'This is a new skill; it now also appears in your list of saved skills.',
  Updated: 'Your list of saved skills now shows this version.',
};

type Approval = ApprovalRequest & { decision: string };

function result(
  change: SkillChange,
  verb: keyof typeof notes,
  approval: Approval
) {
  if (change.kind !== 'saved') {
    return { ...failure(failures[change.kind]), details: { approval } };
  }

  const { skill } = change;

  return {
    details: { ...skill, approval },
    output: text(
      `${verb} the skill [${skill.id}] ${skill.name}.\n\n${notes[verb]}`
    ),
  };
}

function render(saved: readonly Skill[]) {
  const lines = [
    'Skills are reusable instructions the user has saved. When a request matches a skill, read it with skill_read and follow its instructions. Create, update, or delete skills with skill_create, skill_update, and skill_delete when the user asks.',
  ];

  if (saved.length > 0) {
    lines.push(
      'Saved skills, with their ids:',
      ...saved.map(
        ({ description, id, name }) => `- [${id}] ${name}: ${description}`
      )
    );
  }

  return lines.join('\n');
}

const name = str({
  description: 'A short name for the skill.',
  maxLength: SKILL_NAME_LENGTH,
  minLength: 1,
});

const description = str({
  description: 'One sentence saying when to use the skill.',
  maxLength: SKILL_DESCRIPTION_LENGTH,
  minLength: 1,
});

const instructions = str({
  description: 'The full instructions to follow when using the skill.',
  maxLength: SKILL_INSTRUCTIONS_LENGTH,
  minLength: 1,
});

const id = str({ description: 'The id of the skill.' });

export function skills(owner: Owner) {
  const skillRead = defineTool({
    name: 'skill_read',
    description:
      "Read a saved skill's full instructions. Read a skill before following it.",
    parameters: obj({ id }),
    execute: async (args, api, context) => {
      const doc = await api.snapshot(
        SkillsDoc,
        await owner(api.conversationId),
        context
      );

      const skill = doc?.skills.find((entry) => entry.id === args.id);

      if (!skill) {
        return failure(failures.missing);
      }

      return {
        details: skill,
        output: text(`# ${skill.name}\n\n${skill.instructions}`),
      };
    },
  });

  const skillCreate = defineTool({
    name: 'skill_create',
    callers: ['model'],
    description:
      'Save a new skill: reusable instructions to follow whenever a matching request comes up. Use it when the user asks you to create or save a skill. The user approves it first.',
    parameters: obj({ description, instructions, name }),
    execute: async (fields, api, context) => {
      const { approval, approved } = await requestApproval(api, context, {
        action: `Save the “${fields.name}” skill`,
        summary: [fields.description, fields.instructions],
      });

      if (!approved) {
        return {
          details: { approval },
          output: text('The user declined to save this skill.'),
        };
      }

      const skillId = await api.memo('id', randomUUID().slice(0, 8), context);

      const key = await owner(api.conversationId);

      const change = await api.commit(
        async (tx) =>
          createSkill(await tx.doc(SkillsDoc, key, null), {
            ...fields,
            id: skillId,
            now: api.now(),
          }),
        context
      );

      return result(change, 'Created', approval);
    },
  });

  const skillUpdate = defineTool({
    name: 'skill_update',
    callers: ['model'],
    description:
      "Change a saved skill's name, description, or instructions. Only the fields you pass change. The user approves it first.",
    parameters: obj({
      description: opt(description),
      id,
      instructions: opt(instructions),
      name: opt(name),
    }),
    execute: async (fields, api, context) => {
      const key = await owner(api.conversationId);

      const current = (
        await api.snapshot(SkillsDoc, key, context)
      )?.skills.find((skill) => skill.id === fields.id);

      if (!current) {
        return failure(failures.missing);
      }

      const { approval, approved } = await requestApproval(api, context, {
        action: `Change the “${current.name}” skill`,
        summary: [
          fields.name === undefined ? '' : `Name: ${fields.name}`,
          fields.description === undefined
            ? ''
            : `Description: ${fields.description}`,
          fields.instructions === undefined
            ? ''
            : `Instructions: ${fields.instructions}`,
        ].filter(Boolean),
      });

      if (!approved) {
        return {
          details: { approval },
          output: text('The user declined to change this skill.'),
        };
      }

      const change = await api.commit(
        async (tx) =>
          updateSkill(await tx.doc(SkillsDoc, key, null), {
            ...fields,
            now: api.now(),
          }),
        context
      );

      return result(change, 'Updated', approval);
    },
  });

  const skillDelete = defineTool({
    name: 'skill_delete',
    description:
      'Delete a saved skill. Use it when the user asks to remove one.',
    parameters: obj({ id }),
    execute: async (args, api, context) => {
      const key = await owner(api.conversationId);

      const removed = await api.commit(
        async (tx) => deleteSkill(await tx.doc(SkillsDoc, key, null), args.id),
        context
      );

      if (!removed) {
        return failure(failures.missing);
      }

      return {
        details: removed,
        output: text(`Deleted the skill [${removed.id}] ${removed.name}.`),
      };
    },
  });

  return defineExtension({
    name: 'lab.skills',
    sections: [
      section('skills', async ({ conversationId, read }, context) => {
        const doc = await read.snapshot(
          SkillsDoc,
          await owner(conversationId),
          context
        );

        return render(doc?.skills ?? []);
      }),
    ],
    tools: [skillCreate, skillDelete, skillRead, skillUpdate],
  });
}
