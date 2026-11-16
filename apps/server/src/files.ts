const CLOSE = '\n</file>';

const SEPARATOR = '\n\n';

function escape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function open(name: string) {
  return `<file name="${escape(name)}">\n`;
}

export function fileBlock(name: string, text: string) {
  return `${open(name)}${text}${CLOSE}`;
}

function end(body: string, next: string | undefined) {
  if (next === undefined) {
    return body.endsWith(CLOSE) ? body.length - CLOSE.length : -1;
  }

  return body.indexOf(`${CLOSE}${SEPARATOR}${open(next)}`);
}

export function fileTexts(blocks: string, names: string[]): string[] {
  const [name, ...rest] = names;

  if (name === undefined || !blocks.startsWith(open(name))) {
    return [];
  }

  const body = blocks.slice(open(name).length);

  const length = end(body, rest[0]);

  if (length < 0) {
    return [];
  }

  return [
    body.slice(0, length),
    ...fileTexts(body.slice(length + CLOSE.length + SEPARATOR.length), rest),
  ];
}
