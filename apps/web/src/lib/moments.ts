import type { LiveMark } from '@/components/ui/live-mark';
import type { ComponentProps } from 'react';

type Mark = NonNullable<ComponentProps<typeof LiveMark>['state']>;

type Limit =
  | { by?: string; max: number; per: 'day' | 'ever' | 'session' }
  | { by?: never; max: number; per: 'tick' };

type Budget = readonly [Limit, ...Limit[]];

type Fallback =
  | { plain: string; quiet: 'plain' }
  | { plain?: never; quiet: 'keep' | 'skip' };

type Common = Fallback & {
  budget?: Budget;
  hidden?: 'wait';
  reduced: 'skip' | 'still';
  use: string;
};

type Shape =
  | { effect: 'confetti'; mark?: Mark; ms: number }
  | { effect?: never; mark?: Mark; ms?: number };

export type Moment =
  | (Common & {
      budget?: never;
      effect?: never;
      hidden?: never;
      mark?: never;
      ms?: never;
      tier: 'ambient';
    })
  | (Common & { effect?: never; mark?: Mark; ms?: number; tier: 'run' })
  | (Common &
      Shape & {
        budget: Budget;
        quiet: 'plain' | 'skip';
        tier: 'landmark';
      })
  | (Common & Shape & { quiet: 'skip'; reduced: 'skip'; tier: 'egg' });

export const moments = {
  'apps.develop': {
    quiet: 'skip',
    reduced: 'still',
    tier: 'ambient',
    use: 'An app that finishes building in view develops from its grey preview into full color.',
  },
  'apps.face': {
    quiet: 'skip',
    reduced: 'still',
    tier: 'ambient',
    use: 'An app being built draws its pixel face a cell at a time as its code streams in.',
  },
  'apps.glide': {
    quiet: 'skip',
    reduced: 'skip',
    tier: 'ambient',
    use: 'An app that finishes building in view glides from its preview height to its own.',
  },
  'apps.peek': {
    plain: 'The mark fades in place.',
    quiet: 'plain',
    reduced: 'still',
    tier: 'ambient',
    use: 'Lab’s mark rises over an app card’s top edge while the app waits on lab.ask.',
  },
  'ask.ahem': {
    budget: [{ by: 'call', max: 1, per: 'session' }],
    mark: 'ahem',
    quiet: 'skip',
    reduced: 'still',
    tier: 'run',
    use: 'A question has waited eight seconds in a tab you can see, so the mark clears its throat once.',
  },
  'ask.drift': {
    mark: 'drift',
    ms: 640,
    quiet: 'skip',
    reduced: 'still',
    tier: 'run',
    use: 'You deny a request and its coral pixel drifts away.',
  },
  'ask.gulp': {
    mark: 'gulp',
    ms: 640,
    quiet: 'skip',
    reduced: 'still',
    tier: 'run',
    use: 'You answer a question and the mark swallows its coral pixel.',
  },
  'ask.mark': {
    mark: 'waiting',
    plain: 'An attention dot.',
    quiet: 'plain',
    reduced: 'still',
    tier: 'run',
    use: 'Lab is waiting for your answer, so the mark holds a coral pixel.',
  },
  'chat.caret': {
    quiet: 'skip',
    reduced: 'still',
    tier: 'ambient',
    use: 'A square caret pulses at the end of a reply while it streams.',
  },
  'chat.thinking': {
    plain: 'Always “Thinking”.',
    quiet: 'plain',
    reduced: 'still',
    tier: 'run',
    use: 'The thinking line says more as a wait passes 4, 20 and 90 seconds.',
  },
  'copy.fold': {
    plain: 'The icon swaps to a check.',
    quiet: 'plain',
    reduced: 'still',
    tier: 'ambient',
    use: 'Copy folds its two sheets into a check.',
  },
  'empty.enter': {
    budget: [{ by: 'pose', max: 1, per: 'session' }],
    hidden: 'wait',
    quiet: 'skip',
    reduced: 'still',
    tier: 'run',
    use: 'An empty view’s glyph plays its entrance the first time you meet that pose in a session.',
  },
  'empty.voice': {
    plain: 'Plain words and a still glyph.',
    quiet: 'plain',
    reduced: 'still',
    tier: 'run',
    use: 'An empty view speaks in Lab’s voice and strikes a pose.',
  },
  'error.pose': {
    plain: 'A warning icon.',
    quiet: 'plain',
    reduced: 'still',
    tier: 'run',
    use: 'A view that couldn’t load tips the flask over.',
  },
  'home.arrive': {
    budget: [{ max: 1, per: 'session' }],
    hidden: 'wait',
    quiet: 'keep',
    reduced: 'still',
    tier: 'run',
    use: 'Home rises in on the first visit of a session.',
  },
  'home.brief-roll': {
    plain: 'Plain counts that never roll.',
    quiet: 'plain',
    reduced: 'still',
    tier: 'run',
    use: 'Home says in one sentence what finished, what needs you and what is running, and a count rolls when it changes.',
  },
  'home.caught-up': {
    budget: [{ max: 1, per: 'day' }],
    mark: 'done',
    ms: 1_000,
    quiet: 'skip',
    reduced: 'still',
    tier: 'landmark',
    use: 'You clear the last thing on home, and the mark hops once a day.',
  },
  'home.fizz': {
    budget: [{ max: 1, per: 'session' }],
    mark: 'fizz',
    ms: 2_250,
    quiet: 'skip',
    reduced: 'skip',
    tier: 'egg',
    use: 'You shake the home mark five times and it fizzes over, once a session.',
  },
  'home.idle': {
    quiet: 'skip',
    reduced: 'skip',
    tier: 'ambient',
    use: 'The home mark leans in while you type and dozes after six idle minutes.',
  },
  'home.prompt': {
    mark: 'assemble',
    plain: 'The same question every time, with the mark at rest.',
    quiet: 'plain',
    reduced: 'still',
    tier: 'run',
    use: 'Home asks what you’re working on in varied words, and on a first visit the mark assembles and the words fade in.',
  },
  'home.toy': {
    mark: 'held',
    quiet: 'skip',
    reduced: 'skip',
    tier: 'egg',
    use: 'You pick the home mark up, and it bubbles when you let go.',
  },
  'home.try': {
    plain: 'Only lines about your own projects and apps.',
    quiet: 'plain',
    reduced: 'still',
    tier: 'ambient',
    use: 'On a day with no news, home offers one thing Lab can do that you haven’t tried.',
  },
  'image.develop': {
    ms: 900,
    quiet: 'skip',
    reduced: 'still',
    tier: 'run',
    use: 'An image develops from a grey blur into color as it loads.',
  },
  'memory.saved': {
    quiet: 'skip',
    reduced: 'still',
    tier: 'run',
    use: 'Lab saves a memory while you watch, so a ribbon drops and a highlighter sweeps the note.',
  },
  'places.dissolve': {
    quiet: 'skip',
    reduced: 'skip',
    tier: 'ambient',
    use: 'Delete forever and Empty trash wipe a row into falling grey pixels before it closes.',
  },
  'places.fresh': {
    quiet: 'skip',
    reduced: 'skip',
    tier: 'ambient',
    use: 'Library items made since your last visit drop onto the shelf, six staggered at most.',
  },
  'places.grow': {
    quiet: 'skip',
    reduced: 'skip',
    tier: 'ambient',
    use: 'A Library image grows from its tile into the viewer and back.',
  },
  'places.ledger': {
    quiet: 'skip',
    reduced: 'skip',
    tier: 'ambient',
    use: 'Usage bars rise together when you change the range.',
  },
  'places.pour': {
    quiet: 'skip',
    reduced: 'skip',
    tier: 'ambient',
    use: 'The budget flask pours once a session on first view.',
  },
  'places.roll': {
    quiet: 'skip',
    reduced: 'skip',
    tier: 'ambient',
    use: 'A count that changes in place rolls to its new value.',
  },
  'places.wind': {
    quiet: 'skip',
    reduced: 'skip',
    tier: 'ambient',
    use: 'Resuming a scheduled task winds its clock hand once.',
  },
  'plan.complete': {
    budget: [
      { by: 'plan', max: 1, per: 'ever' },
      { max: 3, per: 'day' },
    ],
    effect: 'confetti',
    hidden: 'wait',
    ms: 1_000,
    quiet: 'skip',
    reduced: 'skip',
    tier: 'landmark',
    use: 'The last step of a plan is done while you watch, and the count bursts into pixel confetti.',
  },
  'rail.attention': {
    plain: 'The dot appears.',
    quiet: 'plain',
    reduced: 'still',
    tier: 'ambient',
    use: 'The needs-you dot pops onto the collapsed rail.',
  },
  'rail.done': {
    mark: 'done',
    ms: 700,
    quiet: 'skip',
    reduced: 'skip',
    tier: 'run',
    use: 'A chat you aren’t looking at finishes, and the mark on the collapsed rail hops.',
  },
  'retry.spin': {
    quiet: 'skip',
    reduced: 'still',
    tier: 'ambient',
    use: 'Retry spins once when you press it on a reply that didn’t fail.',
  },
  'row.handoff': {
    budget: [{ max: 6, per: 'tick' }],
    mark: 'handoff',
    ms: 950,
    quiet: 'skip',
    reduced: 'still',
    tier: 'run',
    use: 'A chat finishes in the background, and its row mark hops and hands over to the unread dot.',
  },
  'row.title': {
    ms: 800,
    plain: 'The title appears.',
    quiet: 'plain',
    reduced: 'still',
    tier: 'run',
    use: 'A new chat gets its title, which fades in word by word over a yellow wash.',
  },
  'run.done': {
    hidden: 'wait',
    mark: 'done',
    ms: 1_000,
    quiet: 'skip',
    reduced: 'still',
    tier: 'run',
    use: 'A turn that worked for ten seconds or more finishes in the open chat, and the mark hops.',
  },
  'run.failure': {
    mark: 'broken',
    plain: 'A status icon.',
    quiet: 'plain',
    reduced: 'still',
    tier: 'run',
    use: 'A reply fails, and the mark lies slipped apart beside the reason.',
  },
  'run.mark': {
    mark: 'thinking',
    quiet: 'skip',
    reduced: 'still',
    tier: 'run',
    use: 'The Worked line carries the living mark.',
  },
  'run.proud': {
    hidden: 'wait',
    mark: 'proud',
    ms: 1_000,
    quiet: 'skip',
    reduced: 'still',
    tier: 'run',
    use: 'A turn of two minutes or eight steps finishes in the open chat, and the mark hops high with sparkles.',
  },
  'run.slip': {
    mark: 'error',
    ms: 620,
    quiet: 'skip',
    reduced: 'still',
    tier: 'run',
    use: 'A reply fails after one that didn’t, and the mark slips apart.',
  },
  'tab.signal': {
    quiet: 'keep',
    reduced: 'still',
    tier: 'run',
    use: 'A chat finishes or needs you while the tab is hidden, and the tab’s title and icon say so.',
  },
} as const satisfies Record<`${string}.${string}`, Moment>;

export type MomentId = keyof typeof moments;
