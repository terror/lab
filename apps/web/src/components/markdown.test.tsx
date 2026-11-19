import { preferencesQueryOptions } from '@/lib/preferences';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { expect, test, vi } from 'vitest';
import '@/index.css';

import { Markdown } from './markdown';

test('mermaid code blocks render as diagrams', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(
    <Markdown streaming={false}>
      {'```mermaid\nflowchart LR\n  foo --> bar\n```'}
    </Markdown>
  );

  await expect
    .poll(
      () =>
        [
          ...(screen.container
            .querySelector('lab-mermaid')
            ?.shadowRoot?.querySelectorAll('svg .nodeLabel') ?? []),
        ].map((node) => node.textContent),
      { timeout: 15_000 }
    )
    .toEqual(['foo', 'bar']);

  const actions = screen.getByRole('combobox', { name: 'Diagram actions' });
  const download = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  const blobs = vi.spyOn(URL, 'createObjectURL');

  await actions.selectOptions('Download SVG');
  await actions.selectOptions('Download PNG');
  await expect
    .poll(() =>
      download.mock.instances.map(
        (link) => link instanceof HTMLAnchorElement && link.download
      )
    )
    .toEqual(['diagram.svg', 'diagram.png']);
  expect(
    blobs.mock.calls.map(([blob]) => blob instanceof Blob && blob.type)
  ).toEqual(['image/svg+xml', 'image/png']);
});

test('tables can be copied as Markdown, CSV and TSV', async () => {
  stubFetch(() => Response.json({}));
  const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

  const { screen } = await renderWithQuery(
    <Markdown streaming={false}>
      {'| foo | bar |\n| --- | --- |\n| a,b | c |'}
    </Markdown>
  );

  const actions = screen.getByRole('combobox', { name: 'Table actions' });
  await actions.selectOptions('Copy as Markdown');
  await actions.selectOptions('Copy as CSV');
  await actions.selectOptions('Copy as TSV');

  expect(copy.mock.calls).toEqual([
    ['| foo | bar |\n| --- | --- |\n| a,b | c |'],
    ['foo,bar\n"a,b",c'],
    ['foo\tbar\na,b\tc'],
  ]);
});

test('mermaid diagrams follow theme switches', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(
    <Markdown streaming={false}>
      {'```mermaid\nflowchart LR\n  foo --> bar\n```'}
    </Markdown>
  );

  const fill = () => {
    const node = screen.container
      .querySelector('lab-mermaid')
      ?.shadowRoot?.querySelector('svg .node rect');

    return node ? getComputedStyle(node).fill : undefined;
  };

  await expect.poll(fill, { timeout: 10_000 }).toBe('rgb(238, 238, 238)');

  document.documentElement.classList.add('dark');

  await expect.poll(fill, { timeout: 10_000 }).toBe('rgb(31, 32, 32)');

  document.documentElement.classList.remove('dark');
});

test('a streaming reply ends in a pulsing caret that fades once it finishes', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(
    <>
      <Markdown streaming>{'foo\n\nbar'}</Markdown>
      <Markdown streaming={false}>baz</Markdown>
    </>
  );

  const carets = () => {
    const streamed = screen.container.querySelector('[data-reply-streaming]');

    return {
      paragraphs: [...screen.container.querySelectorAll('p')].map(
        (paragraph) => {
          const caret = getComputedStyle(paragraph, '::after');

          return [paragraph.textContent, caret.content, caret.animationName];
        }
      ),
      pulse: streamed && getComputedStyle(streamed).animationName,
    };
  };

  await expect.poll(carets).toEqual({
    paragraphs: [
      ['foo', 'none', 'none'],
      ['bar', '""', 'none'],
      ['baz', 'none', 'none'],
    ],
    pulse: 'caret-pulse, caret-pulse',
  });

  await screen.rerender(
    <>
      <Markdown streaming={false}>{'foo\n\nbar'}</Markdown>
      <Markdown streaming={false}>baz</Markdown>
    </>
  );

  await expect.poll(carets).toEqual({
    paragraphs: [
      ['foo', 'none', 'none'],
      ['bar', '""', 'caret-out'],
      ['baz', 'none', 'none'],
    ],
    pulse: 'none',
  });
});

test('a reply streams without a caret when Lab is quiet', async () => {
  stubFetch(() => Response.json({}));

  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, {
    ...defaultPreferences,
    personality: 'quiet',
  });

  const { screen } = await renderWithQuery(
    <Markdown streaming>foo</Markdown>,
    client
  );

  await expect.element(screen.getByText('foo')).toBeVisible();

  expect(
    getComputedStyle(
      screen.container.querySelector('p') ?? document.body,
      '::after'
    ).content
  ).toBe('none');
});

test('finished messages are not patched as if they were cut off', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(
    <Markdown streaming={false}>{'**foo** *bar'}</Markdown>
  );

  await expect.element(screen.getByText('foo')).toBeVisible();

  expect(screen.container.querySelector('p')?.textContent).toBe('foo *bar');
});

test('single line breaks are kept', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(
    <Markdown streaming={false}>{'foo\nbar'}</Markdown>
  );

  await expect
    .poll(() => screen.container.querySelector('p')?.innerText)
    .toBe('foo\nbar');
});

test('streamed words fade in', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(
    <Markdown streaming>{'foo bar'}</Markdown>
  );

  await expect.element(screen.getByText('foo bar')).toBeVisible();

  await screen.rerender(<Markdown streaming>foo bar baz</Markdown>);

  await expect
    .poll(() => {
      const token = screen.container.querySelector('[data-animated=true]');

      return token && getComputedStyle(token).animationName;
    })
    .toBe('markdown-fade-in');
});

test('code blocks and tables can be scrolled from the keyboard', async () => {
  stubFetch(() =>
    Response.json({
      preferences: { chatSort: 'activity', lineNumbers: false, theme: 'dark' },
    })
  );

  const { screen } = await renderWithQuery(
    <Markdown streaming={false}>
      {'```ts\nfoo\n```\n\n| bar |\n| --- |\n| baz |'}
    </Markdown>
  );

  await expect
    .poll(() =>
      [...screen.container.querySelectorAll('[tabindex]')].map((element) => [
        element.getAttribute('role'),
        element.getAttribute('aria-label'),
        element.getAttribute('tabindex'),
      ])
    )
    .toEqual([
      ['group', 'Code', '0'],
      [null, 'Table', '0'],
    ]);
});

test('code actions appear on hover and keyboard focus without taking a row', async () => {
  stubFetch(() => Response.json({}));

  const { screen } = await renderWithQuery(
    <Markdown streaming={false}>{'foo\n\n```ts\nbar\n```'}</Markdown>
  );

  const prose = screen.getByText('foo');
  const code = screen.getByRole('group', { name: 'Code' });
  await prose.hover();
  const header = screen.container.querySelector('[data-markdown=code-header]');
  if (!header) throw new Error('Missing code header');

  const opacity = () => getComputedStyle(header).opacity;
  expect(getComputedStyle(header).position).toBe('absolute');
  await expect.poll(opacity).toBe('0');
  await code.hover();
  await expect.poll(opacity).toBe('1');
  await prose.hover();
  await expect.poll(opacity).toBe('0');
  screen.getByRole('button', { name: 'Copy code' }).element().focus();
  await expect.poll(opacity).toBe('1');
});

test('streamed code keeps its colors and line numbers when the fence closes', async () => {
  stubFetch(() => Response.json({}));

  const client = new QueryClient();
  client.setQueryData(preferencesQueryOptions.queryKey, {
    ...defaultPreferences,
    lineNumbers: true,
  });

  const source = '```ts\nconst foo = 42;';
  const { screen } = await renderWithQuery(
    <Markdown streaming>{source}</Markdown>,
    client
  );

  const colors = () => {
    const code = screen.container.querySelector('pre code');
    const keyword = code?.querySelector('span[style]');
    return [
      code?.textContent,
      keyword && getComputedStyle(keyword).color,
      screen.container.querySelector('[data-markdown=line-numbers]')
        ?.textContent,
    ];
  };

  await expect
    .poll(colors)
    .toEqual(['const foo = 42;\n', 'rgb(211, 42, 97)', '1']);

  await screen.rerender(
    <Markdown streaming={false}>{source + '\n```'}</Markdown>
  );
  document.documentElement.classList.add('dark');

  try {
    await expect
      .poll(colors)
      .toEqual(['const foo = 42;\n', 'rgb(255, 103, 141)', '1']);

    client.setQueryData(preferencesQueryOptions.queryKey, {
      ...defaultPreferences,
      lineNumbers: true,
      syntaxTheme: 'github',
    });

    await expect
      .poll(colors)
      .toEqual(['const foo = 42;\n', 'rgb(249, 117, 131)', '1']);
  } finally {
    document.documentElement.classList.remove('dark');
  }
});
