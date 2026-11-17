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
    connectSrc: ["'self'", 'https://*.ingest.us.sentry.io'],
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

export const docsSecurityPolicy = {
  connectSrc: ["'self'", 'https://cdn.jsdelivr.net'],
  defaultSrc: ["'self'"],
  fontSrc: ["'self'", 'data:', 'https://fonts.scalar.com'],
  frameAncestors: ["'none'"],
  imgSrc: ["'self'", 'data:'],
  objectSrc: ["'none'"],
  scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.scalar.com'],
};
