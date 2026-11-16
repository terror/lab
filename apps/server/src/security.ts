import { createHash } from 'node:crypto';

function hash(source: string) {
  return `'sha256-${createHash('sha256').update(source).digest('base64')}'`;
}

export function inlineScriptHashes(html: string) {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    ([, source = '']) => hash(source)
  );
}

export function contentSecurityPolicy(html: string) {
  return {
    baseUri: ["'self'"],
    connectSrc: ["'self'"],
    defaultSrc: ["'self'"],
    fontSrc: ["'self'", 'data:'],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    imgSrc: ["'self'", 'data:', 'blob:'],
    objectSrc: ["'none'"],
    scriptSrc: ["'self'", "'wasm-unsafe-eval'", ...inlineScriptHashes(html)],
    styleSrc: ["'self'", "'unsafe-inline'"],
    workerSrc: ["'self'", 'blob:'],
  };
}
