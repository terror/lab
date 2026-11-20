import { ToolConversation } from '@/components/tools/types';
import { renderWithQuery } from '@/test/helpers';
import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { artifactRenderers } from './tools/artifacts';

test('a full-screen artifact opens focused on its dialog so Escape closes it', async () => {
  const { screen } = await renderWithQuery(
    artifactRenderers.artifact_create.inline({
      active: false,
      args: { content: 'foo', id: 'bar', title: 'baz' },
      callId: 'qux',
      details: { title: 'baz', version: 1 },
      history: [],
      output: '',
    })
  );

  await screen.getByRole('button', { name: 'Full screen' }).click();

  await expect.element(screen.getByRole('dialog')).toHaveFocus();

  await userEvent.keyboard('{Escape}');

  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
});

function card(active: boolean) {
  return artifactRenderers.artifact_create.inline({
    active,
    args: { content: 'foo', id: 'bar', title: 'baz' },
    callId: 'qux',
    details: active ? undefined : { title: 'baz', version: 1 },
    history: [],
    output: '',
  });
}

test('an artifact built in view switches on from its grey preview height, and one opened later does not', async () => {
  const { screen } = await renderWithQuery(card(true));

  const frame = () => {
    const element = screen.container.querySelector('iframe');

    return {
      height: element?.style.height,
      preview: element?.hasAttribute('data-preview'),
    };
  };

  expect(frame()).toEqual({ height: '360px', preview: true });

  await screen.rerender(card(false));

  expect(frame()).toEqual({ height: '360px', preview: true });

  await screen.unmount();

  const later = await renderWithQuery(card(false));

  expect({
    height: later.screen.container.querySelector('iframe')?.style.height,
    preview: later.screen.container
      .querySelector('iframe')
      ?.hasAttribute('data-preview'),
  }).toEqual({ height: '48px', preview: false });
});

test('a building artifact draws one more cell of its face for every 600 characters', async () => {
  const { screen } = await renderWithQuery(
    <ToolConversation value={7}>
      {artifactRenderers.artifact_create.inline({
        active: true,
        args: { content: 'foo'.repeat(400), id: 'bar', title: 'baz' },
        callId: 'qux',
        details: undefined,
        history: [],
        output: '',
      })}
    </ToolConversation>
  );

  const lit = [...screen.container.querySelectorAll('[data-slot=sigil] rect')]
    .filter((cell) => cell.getAttribute('opacity') === '1')
    .map((cell) => `${cell.getAttribute('x')},${cell.getAttribute('y')}`);

  expect(lit).toEqual(['6.5,6.5', '6.5,0.5', '3.5,6.5', '9.5,6.5']);
});

function building(content: string) {
  return (
    <ToolConversation value={7}>
      {artifactRenderers.artifact_create.inline({
        active: true,
        args: { content, id: 'foo', title: 'bar' },
        callId: 'baz',
        details: undefined,
        history: [],
        output: '',
      })}
    </ToolConversation>
  );
}

test('a building artifact holds its frame’s room before the first character arrives', async () => {
  const { screen } = await renderWithQuery(building(''));

  const reserved = screen.container.querySelector<HTMLElement>(
    '[data-slot=skeleton]'
  )?.style.height;

  await screen.rerender(building('<p>qux</p>'));

  await expect
    .poll(() => screen.container.querySelector('iframe')?.style.height)
    .toBe('360px');

  expect({
    reserved,
    skeleton: screen.container.querySelector('[data-slot=skeleton]'),
  }).toEqual({ reserved: '360px', skeleton: null });
});
