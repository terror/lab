const hues = ['coral', 'blue', 'yellow'];

export async function confetti(from: Element) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const { default: fire } = await import('canvas-confetti');

  const rect = from.getBoundingClientRect();
  const style = getComputedStyle(from);

  await fire({
    colors: hues.map((hue) => style.getPropertyValue(`--spark-${hue}`).trim()),
    flat: true,
    gravity: 1.4,
    origin: {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height / 2) / window.innerHeight,
    },
    particleCount: 28,
    scalar: 0.6,
    shapes: ['square'],
    spread: 80,
    startVelocity: 16,
    ticks: 60,
  });
}
