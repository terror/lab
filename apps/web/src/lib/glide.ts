let origin: number | undefined;

export function holdGlide(top: number) {
  origin = top;

  return () => {
    origin = undefined;
  };
}

export function glideOrigin() {
  return origin;
}
