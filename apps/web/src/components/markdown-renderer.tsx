import { useDark } from '@/lib/theme';
import dark from '@pierre/highlights/themes/pierre-dark';
import light from '@pierre/highlights/themes/pierre-light';
import { createHighlightsPlugin } from '@pierre/words/highlights';
import { escapeHtml } from '@pierre/words/html';
import { type CodeOptions, Markdown } from '@pierre/words/react';

import { diagramFrame, markdownAction, tableFrame } from './markdown-actions';

class MermaidDiagram extends HTMLElement {
  static observedAttributes = ['data-theme', 'data-source'];

  #revision = 0;

  connectedCallback() {
    void this.draw();
  }

  attributeChangedCallback() {
    if (this.isConnected) {
      void this.draw();
    }
  }

  async draw() {
    const revision = ++this.#revision;
    const source = this.dataset.source ?? '';

    try {
      const { default: mermaid } = await import('mermaid');

      if (!this.isConnected || revision !== this.#revision) {
        return;
      }

      mermaid.initialize({
        securityLevel: 'strict',
        startOnLoad: false,
        suppressErrorRendering: true,
        theme: this.dataset.theme === 'dark' ? 'dark' : 'neutral',
      });

      const { svg } = await mermaid.render(
        `diagram-${crypto.randomUUID()}`,
        source
      );

      if (this.isConnected && revision === this.#revision) {
        const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
        root.innerHTML = svg;
      }
    } catch {
      if (revision === this.#revision) {
        this.shadowRoot?.replaceChildren(document.createElement('slot'));
      }
    }
  }
}

if (!customElements.get('lab-mermaid')) {
  customElements.define('lab-mermaid', MermaidDiagram);
}

function diagrams(theme: 'dark' | 'light') {
  return {
    language: 'mermaid',
    render({ code, isIncomplete }: CodeOptions) {
      if (isIncomplete) {
        return null;
      }

      const source = escapeHtml(code);

      return diagramFrame(
        `<lab-mermaid data-theme="${theme}" data-source="${source}"><pre>${source}</pre></lab-mermaid>`
      );
    },
  };
}

const code = createHighlightsPlugin({
  defaultColor: 'light-dark()',
  themes: { dark, light },
});

const plugins = {
  dark: { code, renderers: [diagrams('dark')] },
  light: { code, renderers: [diagrams('light')] },
};

const components = { table: tableFrame };

export function MarkdownRenderer(props: React.ComponentProps<typeof Markdown>) {
  const isDark = useDark();

  return (
    <Markdown
      {...props}
      components={
        !props.isAnimating && props.children?.includes('|')
          ? components
          : undefined
      }
      onInput={markdownAction}
      plugins={plugins[isDark ? 'dark' : 'light']}
    />
  );
}
