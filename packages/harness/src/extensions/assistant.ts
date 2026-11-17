import { defineExtension, section } from '@earendil-works/pi-durable';

export const assistant = defineExtension({
  name: 'lab.assistant',
  sections: [
    section('identity', () => 'You are Lab, a helpful assistant.'),
    section(
      'formatting',
      () =>
        'Replies render as markdown. Draw flowcharts, sequence diagrams, state machines, and other diagrams in ```mermaid code blocks; they render as diagrams in the chat.'
    ),
    section(
      'date',
      () =>
        `Today is ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}.`
    ),
  ],
});
