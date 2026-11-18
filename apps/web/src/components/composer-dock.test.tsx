import '@/index.css';
import { holdGlide } from '@/lib/glide';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { cdp } from 'vitest/browser';

import { ComposerDock } from './composer-dock';

async function dockKeyframes() {
  const release = holdGlide(300);

  const screen = await render(
    <ComposerDock className='fixed top-0'>
      <p>foo</p>
    </ComposerDock>
  );

  release();

  const glider = screen.getByText('foo').element().parentElement;

  return (glider?.getAnimations() ?? []).map((animation) => {
    const frames =
      animation.effect instanceof KeyframeEffect
        ? animation.effect.getKeyframes()
        : [];

    return [frames.at(0), frames.at(-1)].map(
      (frame) => frame?.transform ?? frame?.opacity
    );
  });
}

test('the dock glides the composer down from where home held it', async () => {
  expect(await dockKeyframes()).toEqual([
    ['translateY(300px)', 'translateY(0px)'],
  ]);
});

test('under reduced motion the dock fades the composer in instead', async ({
  onTestFinished,
}) => {
  await cdp().send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });

  onTestFinished(async () => {
    await cdp().send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: '' }],
    });
  });

  expect(await dockKeyframes()).toEqual([['0', '1']]);
});

test('without a held position the dock stays still', async () => {
  const screen = await render(
    <ComposerDock>
      <p>foo</p>
    </ComposerDock>
  );

  expect(
    screen.getByText('foo').element().parentElement?.getAnimations()
  ).toEqual([]);
});
