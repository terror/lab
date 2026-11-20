import type { LiveMark } from '@/components/ui/live-mark';
import type { ComponentProps } from 'react';

type Mark = NonNullable<ComponentProps<typeof LiveMark>['state']>;

type Limit =
  | { by?: string; max: number; per: 'day' | 'ever' | 'session' }
  | { by?: never; max: number; per: 'tick' };

type Budget = readonly [Limit, ...Limit[]];

type Common = {
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
        tier: 'landmark';
      })
  | (Common & Shape & { reduced: 'skip'; tier: 'egg' });

export const moments = {
  'apps.develop': {
    reduced: 'still',
    tier: 'ambient',
    use: 'An app that finishes building in view develops from its grey preview into full color.',
  },
  'apps.face': {
    reduced: 'still',
    tier: 'ambient',
    use: 'An app being built draws its pixel face a cell at a time as its code streams in.',
  },
  'apps.glide': {
    reduced: 'skip',
    tier: 'ambient',
    use: 'An app that finishes building in view glides from its preview height to its own.',
  },
  'apps.peek': {
    reduced: 'still',
    tier: 'ambient',
    use: 'Lab’s mark rises over an app card’s top edge while the app waits on lab.ask.',
  },
  'ask.ahem': {
    budget: [{ by: 'call', max: 1, per: 'session' }],
    mark: 'ahem',
    reduced: 'still',
    tier: 'run',
    use: 'A question has waited eight seconds in a tab you can see, so the mark clears its throat once.',
  },
  'ask.drift': {
    mark: 'drift',
    ms: 640,
    reduced: 'still',
    tier: 'run',
    use: 'You deny a request and its coral pixel drifts away.',
  },
  'ask.gulp': {
    mark: 'gulp',
    ms: 640,
    reduced: 'still',
    tier: 'run',
    use: 'You answer a question and the mark swallows its coral pixel.',
  },
  'ask.mark': {
    mark: 'waiting',
    reduced: 'still',
    tier: 'run',
    use: 'Lab is waiting for your answer, so the mark holds a coral pixel.',
  },
  'chat.caret': {
    reduced: 'still',
    tier: 'ambient',
    use: 'A square caret pulses at the end of a reply while it streams.',
  },
  'copy.fold': {
    reduced: 'still',
    tier: 'ambient',
    use: 'Copy folds its two sheets into a check.',
  },
  'discovery.hint': {
    reduced: 'still',
    tier: 'run',
    use: 'A margin note teaches one thing the first time it is useful.',
  },
  'discovery.tip': {
    reduced: 'still',
    tier: 'run',
    use: 'An idle composer suggests something you have not tried yet.',
  },
  'empty.enter': {
    budget: [{ by: 'pose', max: 1, per: 'session' }],
    hidden: 'wait',
    reduced: 'still',
    tier: 'run',
    use: 'An empty view’s glyph plays its entrance the first time you meet that pose in a session.',
  },
  'error.pose': {
    reduced: 'still',
    tier: 'run',
    use: 'A view that couldn’t load tips the flask over.',
  },
  'home.arrive': {
    budget: [{ max: 1, per: 'session' }],
    hidden: 'wait',
    reduced: 'still',
    tier: 'run',
    use: 'Home rises in on the first visit of a session.',
  },
  'home.fizz': {
    budget: [{ max: 1, per: 'session' }],
    mark: 'fizz',
    ms: 2_250,
    reduced: 'skip',
    tier: 'egg',
    use: 'You shake the home mark five times and it fizzes over, once a session.',
  },
  'home.idle': {
    reduced: 'skip',
    tier: 'ambient',
    use: 'The home mark leans in while you type and dozes after six idle minutes.',
  },
  'home.prompt': {
    mark: 'assemble',
    reduced: 'still',
    tier: 'run',
    use: 'Home asks what you’re working on in varied words, and on a first visit the mark assembles and the words fade in.',
  },
  'home.toy': {
    mark: 'held',
    reduced: 'skip',
    tier: 'egg',
    use: 'You pick the home mark up, and it bubbles when you let go.',
  },
  'image.develop': {
    ms: 900,
    reduced: 'still',
    tier: 'run',
    use: 'An image develops from a grey blur into color as it loads.',
  },
  'memory.saved': {
    reduced: 'still',
    tier: 'run',
    use: 'Lab saves a memory while you watch, so a ribbon drops and a highlighter sweeps the note.',
  },
  'places.dissolve': {
    reduced: 'skip',
    tier: 'ambient',
    use: 'Delete forever and Empty trash wipe a row into falling grey pixels before it closes.',
  },
  'places.fresh': {
    reduced: 'skip',
    tier: 'ambient',
    use: 'Library items made since your last visit drop onto the shelf, six staggered at most.',
  },
  'places.grow': {
    reduced: 'skip',
    tier: 'ambient',
    use: 'A Library image grows from its tile into the viewer and back.',
  },
  'places.ledger': {
    reduced: 'skip',
    tier: 'ambient',
    use: 'Usage bars rise together when you change the range.',
  },
  'places.pour': {
    reduced: 'skip',
    tier: 'ambient',
    use: 'The budget flask pours once a session on first view.',
  },
  'places.roll': {
    reduced: 'skip',
    tier: 'ambient',
    use: 'A count that changes in place rolls to its new value.',
  },
  'places.wind': {
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
    reduced: 'skip',
    tier: 'landmark',
    use: 'The last step of a plan is done while you watch, and the count bursts into pixel confetti.',
  },
  'rail.attention': {
    reduced: 'still',
    tier: 'ambient',
    use: 'The needs-you dot pops onto the collapsed rail.',
  },
  'rail.done': {
    mark: 'done',
    ms: 700,
    reduced: 'skip',
    tier: 'run',
    use: 'A chat you aren’t looking at finishes, and the mark on the collapsed rail hops.',
  },
  'retry.spin': {
    reduced: 'still',
    tier: 'ambient',
    use: 'Retry spins once when you press it on a reply that didn’t fail.',
  },
  'row.handoff': {
    budget: [{ max: 6, per: 'tick' }],
    mark: 'handoff',
    ms: 950,
    reduced: 'still',
    tier: 'run',
    use: 'A chat finishes in the background, and its row mark hops and hands over to the unread dot.',
  },
  'row.title': {
    ms: 800,
    reduced: 'still',
    tier: 'run',
    use: 'A new chat gets its title, which fades in word by word over a yellow wash.',
  },
  'run.done': {
    hidden: 'wait',
    mark: 'done',
    ms: 1_000,
    reduced: 'still',
    tier: 'run',
    use: 'A turn that worked for ten seconds or more finishes in the open chat, and the mark hops.',
  },
  'run.failure': {
    mark: 'broken',
    reduced: 'still',
    tier: 'run',
    use: 'A reply fails, and the mark lies slipped apart beside the reason.',
  },
  'run.mark': {
    mark: 'thinking',
    reduced: 'still',
    tier: 'run',
    use: 'The Worked line carries the living mark.',
  },
  'run.proud': {
    hidden: 'wait',
    mark: 'proud',
    ms: 1_000,
    reduced: 'still',
    tier: 'run',
    use: 'A turn of two minutes or eight steps finishes in the open chat, and the mark hops high with sparkles.',
  },
  'run.slip': {
    mark: 'error',
    ms: 620,
    reduced: 'still',
    tier: 'run',
    use: 'A reply fails after one that didn’t, and the mark slips apart.',
  },
  'tab.signal': {
    reduced: 'still',
    tier: 'run',
    use: 'A chat finishes or needs you while the tab is hidden, and the tab’s title and icon say so.',
  },
} as const satisfies Record<`${string}.${string}`, Moment>;

export type MomentId = keyof typeof moments;
