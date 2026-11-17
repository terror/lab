import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { chat, toolOutputs } from '../test/client';
import { prompts, script, toolCall } from '../test/models';

test('artifacts are shown once per id', async () => {
  const headers = await signIn();

  const artifact = { content: '<p>foo</p>', id: 'bar', title: 'Baz' };

  script(
    toolCall('artifact_create', artifact),
    toolCall('artifact_create', artifact),
    fauxAssistantMessage('qux')
  );

  const id = await chat(headers, { content: 'foo' });

  expect(await toolOutputs(headers, id)).toEqual([
    'Showed the artifact "Baz" (bar, version 1, 10 characters) to the user.',
    'An artifact with the id "bar" already exists.',
  ]);
});

test('artifacts are updated by unique edits or rewrites and read back', async () => {
  const headers = await signIn();

  script(
    toolCall('artifact_create', {
      content: '<p>foo</p><p>foo</p><b>bar</b>',
      id: 'baz',
      title: 'Baz',
    }),
    toolCall('artifact_update', {
      edits: [{ new: 'qux', old: 'bar' }],
      id: 'baz',
    }),
    toolCall('artifact_update', {
      edits: [{ new: 'qux', old: 'foo' }],
      id: 'baz',
    }),
    toolCall('artifact_update', { content: '<i>foo</i>', id: 'baz' }),
    toolCall('artifact_read', { id: 'baz' }),
    fauxAssistantMessage('done')
  );

  const id = await chat(headers, { content: 'foo' });

  expect(await toolOutputs(headers, id)).toEqual([
    'Showed the artifact "Baz" (baz, version 1, 30 characters) to the user.',
    'Updated the artifact "Baz" (baz) to version 2, 30 characters.',
    'Edit 1 must match exactly once, but its old text matches 2 times.',
    'Updated the artifact "Baz" (baz) to version 3, 10 characters.',
    '"Baz" version 3:\n\n<i>foo</i>',
  ]);
});

test('the prompt explains artifacts once', async () => {
  const headers = await signIn();

  prompts.length = 0;

  await chat(headers, { content: 'foo' });

  const [prompt = {}] = prompts;

  expect(prompt.artifacts).toEqual(
    '<artifacts>\nUse artifact_create when an interactive app, tool, chart, game, or visual would help more than text, and artifact_update with small edits to change one; use a ```mermaid code block for simple diagrams. Artifacts run in a sandbox with no network access, so put all data, CSS, and JavaScript inline and never load external scripts, fonts, or images; the only libraries available are Chart.js 4 at <script src="/frame/vendor/chart.js"></script> and D3 7 at <script src="/frame/vendor/d3.js"></script>. They sit on the chat background, so keep the background transparent and style with the CSS variables --background, --foreground, --muted, --muted-foreground, --border, and --primary, which follow the user\'s theme. Use semantic, labelled HTML and make it work at phone width. From a click handler, lab.send(text) puts a follow-up message in the user\'s message box, for example to ask about a selected item.\n</artifacts>'
  );
});
