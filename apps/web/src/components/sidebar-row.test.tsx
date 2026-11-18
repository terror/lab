import { AnimatePresence, LazyMotion, domAnimation } from 'motion/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { MotionSidebarRow, useRowPresence } from './sidebar-row';

function Row({ name }: { name: string }) {
  const presence = useRowPresence();

  return <MotionSidebarRow {...presence}>{name}</MotionSidebarRow>;
}

function Rows({ names }: { names: string[] }) {
  return (
    <LazyMotion features={domAnimation}>
      <ul>
        <AnimatePresence initial={false}>
          {names.map((name) => (
            <Row key={name} name={name} />
          ))}
        </AnimatePresence>
      </ul>
    </LazyMotion>
  );
}

function listed() {
  return [...document.querySelectorAll('li')].map((row) => row.textContent);
}

test('a removed row folds out of its list before it leaves', async () => {
  const screen = await render(<Rows names={['foo', 'bar']} />);

  await screen.rerender(<Rows names={['bar']} />);

  const folding = listed();

  await expect.poll(listed).toEqual(['bar']);

  expect(folding).toEqual(['foo', 'bar']);
});
