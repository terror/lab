const QUICK_MS = 10_000;

const LONG_MS = 120_000;

const LONG_STEPS = 8;

export function cheerFor(worked: number, steps: number) {
  if (worked < QUICK_MS) {
    return 'idle';
  }

  return worked >= LONG_MS || steps >= LONG_STEPS ? 'proud' : 'done';
}
