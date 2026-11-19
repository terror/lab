export function hash(seed: string) {
  let value = 2_166_136_261;

  for (let index = 0; index < seed.length; index++) {
    value = Math.imul(value ^ seed.charCodeAt(index), 16_777_619);
  }

  return value >>> 0;
}

function mix(value: number) {
  const first = Math.imul(value ^ (value >>> 16), 2_246_822_507);
  const second = Math.imul(first ^ (first >>> 13), 3_266_489_909);

  return (second ^ (second >>> 16)) >>> 0;
}

export function random(seed: string) {
  let state = mix(hash(seed)) || 1;

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;

    return (state >>> 0) / 4_294_967_296;
  };
}
