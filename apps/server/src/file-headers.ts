const sandboxed =
  "sandbox; default-src 'none'; img-src data:; media-src data:; style-src 'unsafe-inline'";

export function fileHeaders(mimeType: string) {
  return {
    'cache-control': 'private, max-age=31536000, immutable',
    'content-type': mimeType,
    'x-content-type-options': 'nosniff',
    ...(mimeType !== 'application/pdf' && {
      'content-security-policy': sandboxed,
    }),
  };
}
