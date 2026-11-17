const MINUTE = 60_000;

const HOUR = 60 * MINUTE;

const DAY = 24 * HOUR;

const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

const monthDay = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
});

const month = new Intl.DateTimeFormat('en-US', { month: 'long' });

const monthYear = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

const minute: [Intl.RelativeTimeFormatUnit, number] = ['minute', MINUTE];

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', DAY],
  ['hour', HOUR],
  minute,
];

export function ago(value: string, now = Date.now()) {
  const elapsed = now - new Date(value).getTime();

  if (elapsed < HOUR) {
    return `${Math.max(1, Math.round(elapsed / MINUTE))}m`;
  }

  if (elapsed < DAY) {
    return `${Math.round(elapsed / HOUR)}h`;
  }

  if (elapsed < 2 * DAY) {
    return 'Yesterday';
  }

  if (elapsed < 7 * DAY) {
    return weekday.format(new Date(value));
  }

  return monthDay.format(new Date(value));
}

export function untilRun(at: string, now = Date.now()) {
  const delta = new Date(at).getTime() - now;

  const [unit, size] = units.find(([, ms]) => Math.abs(delta) >= ms) ?? minute;

  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.round(delta / size),
    unit
  );
}

export function period(value: string, now: Date) {
  const date = new Date(value);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const days = Math.ceil((today.getTime() - date.getTime()) / DAY);

  if (days <= 0) {
    return 'Today';
  }

  if (days === 1) {
    return 'Yesterday';
  }

  if (days <= 7) {
    return 'Previous 7 days';
  }

  if (days <= 30) {
    return 'Previous 30 days';
  }

  return date.getFullYear() === now.getFullYear()
    ? month.format(date)
    : monthYear.format(date);
}

export function duration(milliseconds: number) {
  const seconds = Math.max(1, Math.round(milliseconds / 1_000));

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`;
  }

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function clock(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
