export function hash(seed: string) {
  let value = 2_166_136_261;

  for (let index = 0; index < seed.length; index++) {
    value = Math.imul(value ^ seed.charCodeAt(index), 16_777_619);
  }

  return value >>> 0;
}
