const shortDateFormat = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
});

const sizeUnits = ['B', 'KB', 'MB', 'GB'] as const;

const sizeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function shortDate(value: string | number | Date) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? '' : shortDateFormat.format(date);
}

export function formatBytes(size: number) {
  const power = Math.min(
    sizeUnits.length - 1,
    Math.floor(Math.log10(Math.max(size, 1)) / 3)
  );

  return `${sizeNumber.format(size / 1000 ** power)} ${sizeUnits[power]}`;
}

export function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
