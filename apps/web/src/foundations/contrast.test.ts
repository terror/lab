import '@/index.css';
import { expect, test } from 'vitest';

import { contrast } from './contrast';

test('every spark ink passes AA on every surface in both themes', () => {
  const failing = new Array<string>();

  for (const theme of ['light', 'dark']) {
    const root = document.createElement('div');

    root.className = theme;
    document.body.append(root);

    const style = getComputedStyle(root);

    for (const hue of ['coral', 'blue', 'yellow']) {
      for (const surface of [
        'background',
        'card',
        'muted',
        'popover',
        'sidebar',
        'sidebar-accent',
        `spark-${hue}-wash`,
      ]) {
        const ratio = contrast(
          style.getPropertyValue(`--spark-${hue}-ink`),
          style.getPropertyValue(`--${surface}`)
        );

        if (ratio < 4.5) {
          failing.push(`${theme} ${hue} on ${surface}: ${ratio.toFixed(2)}`);
        }
      }
    }

    root.remove();
  }

  expect(failing).toEqual([]);
});
