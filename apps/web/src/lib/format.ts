const thisYear = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
});

const otherYear = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  style: 'currency',
});

const precise = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 4,
  minimumFractionDigits: 4,
  style: 'currency',
});

const sizeUnits = ['B', 'KB', 'MB', 'GB'] as const;

const sizeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function shortDate(value: string | number | Date, now = new Date()) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const format =
    date.getFullYear() === now.getFullYear() ? thisYear : otherYear;

  return format.format(date);
}

export function calendarDate(value: string, now = new Date()) {
  const [year = Number.NaN, month = 1, day = 1] = value.split('-').map(Number);

  return shortDate(new Date(year, month - 1, day), now);
}

export function formatBytes(size: number) {
  const power = Math.min(
    sizeUnits.length - 1,
    Math.floor(Math.log10(Math.max(size, 1)) / 3)
  );

  return `${sizeNumber.format(size / 1000 ** power)} ${sizeUnits[power]}`;
}

export function formatSpend(value: number) {
  return value > 0 && value < 1
    ? precise.format(value)
    : currency.format(value);
}

export function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
