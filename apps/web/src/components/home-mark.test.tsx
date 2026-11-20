import '@/index.css';
import { Button } from '@/components/ui/button';
import { useDraft } from '@/lib/conversations';
import { preferencesQueryOptions } from '@/lib/preferences';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { LazyMotion, domAnimation } from 'motion/react';
import { expect, test, vi } from 'vitest';

import { HomeMark } from './home-mark';

function Home() {
  const [, setDraft] = useDraft('new');

  return (
    <LazyMotion features={domAnimation}>
      <Button onClick={() => setDraft('foo')}>bar</Button>
      <HomeMark assemble={false} />
    </LazyMotion>
  );
}

function renderHome(personality: 'default' | 'quiet' = 'default') {
  const preferences = { ...defaultPreferences, personality };

  stubFetch(() =>
    Response.json({ chats: [], preferences, runs: [], waiting: [] })
  );

  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, preferences);

  return renderWithQuery(<Home />, client);
}

test('the home mark leans in when the draft changes', async () => {
  const { screen } = await renderHome();

  const lean = () =>
    screen.container.querySelector<HTMLElement>(
      'span:has(> [data-slot=live-mark])'
    )?.style.transform;

  await expect.poll(lean).toBe('none');

  await screen.getByRole('button', { name: 'bar' }).click();

  await expect.poll(lean).toBe('translateY(1.875px) scaleX(1.06) scaleY(0.94)');
});

test('the home mark dozes after six idle minutes and wakes when the pointer moves', async ({
  onTestFinished,
}) => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

  onTestFinished(() => {
    vi.useRealTimers();
  });

  const { screen } = await renderHome();

  const state = () =>
    screen.container
      .querySelector('[data-slot=live-mark]')
      ?.getAttribute('data-state');

  const seen = [state()];

  vi.advanceTimersByTime(359_999);

  await screen.rerender(<Home />);

  seen.push(state());

  vi.advanceTimersByTime(1);

  await screen.rerender(<Home />);

  seen.push(state());

  window.dispatchEvent(new PointerEvent('pointermove'));

  await screen.rerender(<Home />);

  seen.push(state());

  expect(seen).toEqual(['idle', 'idle', 'doze', 'wake']);
});

test('the home mark never dozes when Lab is quiet', async ({
  onTestFinished,
}) => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

  onTestFinished(() => {
    vi.useRealTimers();
  });

  const { screen } = await renderHome('quiet');

  vi.advanceTimersByTime(360_000);

  await screen.rerender(<Home />);

  expect(
    screen.container
      .querySelector('[data-slot=live-mark]')
      ?.getAttribute('data-state')
  ).toBe('idle');
});

function frame() {
  return new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
}

function pointer(clientX: number) {
  return {
    bubbles: true,
    button: 0,
    clientX,
    isPrimary: true,
    pointerType: 'mouse',
  };
}

async function shake(mark: Element) {
  mark.dispatchEvent(new PointerEvent('pointerdown', pointer(0)));

  for (const x of [20, -20, 20, -20, 20, -20, 20]) {
    window.dispatchEvent(new PointerEvent('pointermove', pointer(x)));

    await frame();
  }

  window.dispatchEvent(new PointerEvent('pointerup', pointer(20)));
}

test('shaking the home mark fizzes once a session and only bubbles after that', async () => {
  const { screen } = await renderHome();

  const mark = screen.container.querySelector('[data-slot=live-mark]');

  const state = () => mark?.getAttribute('data-state');

  await import('@/lib/motion-max');
  await frame();

  await shake(mark ?? document.body);

  await expect.poll(state).toBe('fizz');

  await shake(mark ?? document.body);

  await expect.poll(state).toBe('bubble');

  expect(
    Object.keys(
      JSON.parse(window.sessionStorage.getItem('lab:foo:moments') ?? '{}')
    )
  ).toEqual(['home.fizz']);
});

test('the home mark stays put when Lab is quiet', async () => {
  const { screen } = await renderHome('quiet');

  const mark = screen.container.querySelector('[data-slot=live-mark]');

  await import('@/lib/motion-max');
  await frame();

  await shake(mark ?? document.body);

  await frame();

  expect(mark?.getAttribute('data-state')).toBe('idle');
});

test('a mark that was shaken still wakes with a start after its next doze', async ({
  onTestFinished,
}) => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

  onTestFinished(() => {
    vi.useRealTimers();
  });

  const { screen } = await renderHome();

  const mark = screen.container.querySelector('[data-slot=live-mark]');

  const state = () => mark?.getAttribute('data-state');

  await import('@/lib/motion-max');
  await frame();

  const seen = [];

  for (const released of ['fizz', 'bubble']) {
    vi.advanceTimersByTime(360_000);

    await screen.rerender(<Home />);

    seen.push(state());

    window.dispatchEvent(new PointerEvent('pointermove'));

    await screen.rerender(<Home />);

    seen.push(state());

    await shake(mark ?? document.body);

    await expect.poll(state).toBe(released);
  }

  expect(seen).toEqual(['doze', 'wake', 'doze', 'wake']);
});
