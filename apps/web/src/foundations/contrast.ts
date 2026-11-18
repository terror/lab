function luminance(color: string) {
  const context = new OffscreenCanvas(1, 1).getContext('2d');

  if (!context) {
    throw new Error('Canvas is unavailable');
  }

  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);

  const [red = 0, green = 0, blue = 0] = [
    ...context.getImageData(0, 0, 1, 1).data,
  ].map((channel) => {
    const value = channel / 255;

    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrast(first: string, second: string) {
  const pair = [luminance(first), luminance(second)];

  return (Math.max(...pair) + 0.05) / (Math.min(...pair) + 0.05);
}
