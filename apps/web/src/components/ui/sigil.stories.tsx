import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Sigil } from './sigil';

const meta = preview.meta({
  component: Sigil,
  argTypes: {
    kind: { control: 'inline-radio', options: ['app', 'project'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'The face of one made thing: a 5×5 pixel glyph drawn from a seed, mirrored left to right, with 10 to 17 cells lit and the centre always lit. Seed it with a namespaced id, app:{conversationId}:{artifactId} or project:{id}, and never with a title, so a rename keeps the face. An app is a bare glyph and a project sits in a 1px frame. Cells are whole pixels: 3px at sm, 4px at md, 8px at lg. It takes the text color and never a spark. It is hidden from screen readers, so the name always sits beside it. It is still; filled shows only the first cells in the seed’s own order, for a face that is being drawn.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Sigil',
});

const apps = [
  'Pomodoro timer',
  'Reading log',
  'Trip budget',
  'Plant waterer',
  'Standup timer',
  'Habit grid',
];

const projects = [
  'Balcony garden',
  'Weeknight recipes',
  'Thesis notes',
  'Trip to Lisbon',
];

const many = Array.from({ length: 24 }, (_, index) => index + 1);

export const App = meta.story({
  args: { kind: 'app', seed: 'app:34:foo' },
  render: (args) => (
    <ul className='flex w-56 flex-col gap-2 text-sm'>
      {apps.map((name, index) => (
        <li key={name} className='flex items-center gap-2'>
          <Sigil
            {...args}
            className='text-muted-foreground'
            seed={`app:${34 + index}:foo`}
          />
          <span className='truncate'>{name}</span>
        </li>
      ))}
    </ul>
  ),
});

export const Project = meta.story({
  args: { kind: 'project', seed: 'project:1', size: 'lg' },
  render: (args) => (
    <ul className='flex flex-col gap-4'>
      {projects.map((name, index) => (
        <li
          key={name}
          className='flex items-center gap-3 text-2xl font-semibold tracking-tight'
        >
          <Sigil {...args} seed={`project:${index + 1}`} />
          {name}
        </li>
      ))}
    </ul>
  ),
});

export const Sizes = meta.story({
  args: { kind: 'app', seed: 'app:34:foo' },
  render: ({ seed }) => (
    <div className='flex flex-col gap-4'>
      {(['app', 'project'] as const).map((kind) => (
        <div key={kind} className='flex items-end gap-4'>
          {(['sm', 'md', 'lg'] as const).map((size) => (
            <Sigil key={size} kind={kind} seed={seed} size={size} />
          ))}
        </div>
      ))}
    </div>
  ),
});

export const Many = meta.story({
  args: { kind: 'app', seed: 'app:34:foo', size: 'md' },
  render: ({ size }) => (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap gap-2'>
        {many.map((id) => (
          <Sigil key={id} kind='app' seed={`app:34:foo${id}`} size={size} />
        ))}
      </div>
      <div className='flex flex-wrap gap-2'>
        {many.map((id) => (
          <Sigil key={id} kind='project' seed={`project:${id}`} size={size} />
        ))}
      </div>
    </div>
  ),
});

export const Filled = meta.story({
  args: { filled: 6, kind: 'app', seed: 'app:34:foo', size: 'lg' },
});
