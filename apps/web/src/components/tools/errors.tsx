import type { ToolError, ToolErrorKind, ToolIssue } from '@lab/server/schemas';

import { PreviewPassage } from './previews';

const summaries: Record<ToolErrorKind, (error: ToolError) => string> = {
  aborted: () => 'The tool was stopped before it finished.',
  blocked: () => 'The call was blocked, so the tool didn’t run.',
  failed: ({ message }) => message,
  interrupted: () => 'The tool was interrupted and may have partly run.',
  invalid: () => 'The model sent an invalid request, so the tool didn’t run.',
  unavailable: () => 'This tool isn’t available, so it didn’t run.',
};

const states: Record<string, string> = {
  false: 'not expected',
  required: 'missing',
  unevaluatedItems: 'not expected',
  unevaluatedProperties: 'not expected',
};

const conjunction = new Intl.ListFormat('en-US', { type: 'conjunction' });

type Item = { index: number; name: string };

type Group = {
  field: string;
  indexes: number[];
  items: Item[];
  state: string;
};

function located({ keyword, message, path }: ToolIssue) {
  const items: Item[] = [];

  let names: string[] = [];

  for (const segment of path) {
    if (typeof segment === 'number') {
      items.push({ index: segment + 1, name: names.at(-1) ?? 'items' });
      names = [];
    } else {
      names.push(segment);
    }
  }

  return {
    field: names.join('.'),
    items,
    state: states[keyword] ?? `invalid (${message})`,
  };
}

function capitalized(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function singular(name: string) {
  if (name.endsWith('ies')) {
    return `${name.slice(0, -3)}y`;
  }

  return name.endsWith('s') ? name.slice(0, -1) : name;
}

function label({ index, name }: Item) {
  return `${capitalized(singular(name))} ${index}`;
}

function numbers(indexes: readonly number[]) {
  const runs: number[][] = [];

  for (const index of [...new Set(indexes)].toSorted((a, b) => a - b)) {
    const run = runs.at(-1);

    if (run && run.at(-1) === index - 1) {
      run.push(index);
    } else {
      runs.push([index]);
    }
  }

  return conjunction.format(
    runs.flatMap((run) =>
      run.length > 2 ? [`${run[0]}–${run.at(-1)}`] : run.map(String)
    )
  );
}

function place({ indexes, items }: Group) {
  const last = items.at(-1);

  const labels = items.slice(0, -1).map(label);

  if (!last) {
    return labels.join(', ');
  }

  const final =
    indexes.length > 1
      ? `${capitalized(last.name)} ${numbers(indexes)}`
      : label(last);

  return [...labels, final].join(', ');
}

function line(group: Group) {
  const where = place(group);

  if (group.field) {
    return where
      ? `${where}: ${group.field} is ${group.state}`
      : `${group.field} is ${group.state}`;
  }

  if (!where) {
    return `The request is ${group.state}`;
  }

  return `${where} ${group.indexes.length > 1 ? 'are' : 'is'} ${group.state}`;
}

export function issueLines(issues: readonly ToolIssue[]) {
  const groups = new Map<string, Group>();

  for (const issue of issues) {
    const found = located(issue);

    const last = found.items.at(-1);

    const key = JSON.stringify([
      found.items.slice(0, -1),
      last?.name,
      found.field,
      found.state,
    ]);

    const group = groups.get(key);

    if (group) {
      group.indexes.push(last?.index ?? 0);
    } else {
      groups.set(key, { ...found, indexes: last ? [last.index] : [] });
    }
  }

  return [...groups.values()].map(line);
}

export function ToolFailure({ error }: { error: ToolError }) {
  const lines = issueLines(error.issues);

  return (
    <div className='flex flex-col gap-1.5'>
      <PreviewPassage>{summaries[error.kind](error)}</PreviewPassage>
      {lines.length > 0 && (
        <ul className='flex list-disc flex-col gap-0.5 pl-4 text-sm/relaxed text-foreground/80'>
          {lines.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
