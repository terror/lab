export function decodeText(content: Uint8Array) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(content);

    return text.includes('\0') ? undefined : text;
  } catch {
    return undefined;
  }
}

export function storable(text: string) {
  return text.replaceAll('\0', '');
}
