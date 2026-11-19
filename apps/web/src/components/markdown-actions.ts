import { toast } from 'sonner';

const tableActions = [
  'Copy as Markdown',
  'Copy as CSV',
  'Copy as TSV',
  'Download Markdown',
  'Download CSV',
  'Download TSV',
];
const diagramActions = [
  'Copy diagram source',
  'Download MMD',
  'Download SVG',
  'Download PNG',
  'Zoom in',
  'Zoom out',
  'Reset zoom',
];

function actionMenu(body: string, name: string, actions: string[]) {
  const options = [...actions, 'Toggle fullscreen']
    .map((action) => `<option>${action}</option>`)
    .join('');
  return `<div class="markdown-frame"><select aria-label="${name} actions"><option value="">${name} actions</option>${options}</select>${body}</div>`;
}

export function tableFrame(html: string) {
  return actionMenu(html, 'Table', tableActions);
}

export function diagramFrame(html: string) {
  return actionMenu(html, 'Diagram', diagramActions);
}

function tableText(table: HTMLTableElement, format: string) {
  const rows = Array.from(table.rows, (row) =>
    Array.from(row.cells, (cell) => cell.innerText)
  );

  if (format === 'Markdown') {
    const lines = rows.map(
      (row) =>
        `| ${row.map((cell) => cell.replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('\n', '<br>')).join(' | ')} |`
    );
    lines.splice(
      1,
      0,
      `| ${Array.from({ length: table.rows[0]?.cells.length ?? 0 }, () => '---').join(' | ')} |`
    );
    return lines.join('\n');
  }

  const separator = format === 'CSV' ? ',' : '\t';
  return rows
    .map((row) =>
      row
        .map((cell) =>
          cell.includes(separator) || /["\r\n]/.test(cell)
            ? `"${cell.replaceAll('"', '""')}"`
            : cell
        )
        .join(separator)
    )
    .join('\n');
}

function download(name: string, blob: Blob) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function png(svg: string, width: number, height: number) {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve)
  );
  if (!blob) {
    throw new Error('Could not export the diagram.');
  }
  download('diagram.png', blob);
}

async function run(frame: HTMLElement, action: string) {
  if (action === 'Toggle fullscreen') {
    if (document.fullscreenElement === frame) {
      await document.exitFullscreen();
    } else {
      await frame.requestFullscreen();
    }
    return;
  }

  const table = frame.querySelector('table');
  if (table) {
    const format = action.split(' ').at(-1) ?? 'Markdown';
    const text = tableText(table, format);
    if (action.startsWith('Copy')) {
      await navigator.clipboard.writeText(text);
    } else {
      const extension = format === 'Markdown' ? 'md' : format.toLowerCase();
      download(
        `table.${extension}`,
        new Blob([text], { type: 'text/plain;charset=utf-8' })
      );
    }
    return;
  }

  const diagram = frame.querySelector<HTMLElement>('lab-mermaid');
  const source = diagram?.dataset.source ?? '';
  if (action === 'Copy diagram source') {
    await navigator.clipboard.writeText(source);
    return;
  }
  if (action === 'Download MMD') {
    download('diagram.mmd', new Blob([source], { type: 'text/plain' }));
    return;
  }

  const svg = diagram?.shadowRoot?.querySelector('svg');
  if (!svg) {
    throw new Error('The diagram is unavailable.');
  }

  if (action === 'Download SVG' || action === 'Download PNG') {
    const copy = svg.cloneNode(true);
    if (!(copy instanceof SVGSVGElement)) return;
    const { width, height } = svg.viewBox.baseVal;
    copy.style.removeProperty('max-width');
    copy.style.removeProperty('width');
    copy.setAttribute('width', String(width));
    copy.setAttribute('height', String(height));
    const xml = new XMLSerializer().serializeToString(copy);
    if (action === 'Download SVG') {
      download('diagram.svg', new Blob([xml], { type: 'image/svg+xml' }));
    } else {
      await png(xml, width, height);
    }
    return;
  }

  if (action === 'Reset zoom') {
    svg.style.removeProperty('width');
    svg.style.maxWidth = `${svg.viewBox.baseVal.width}px`;
  } else {
    const width = svg.getBoundingClientRect().width;
    svg.style.width = `${width * (action === 'Zoom in' ? 1.25 : 0.8)}px`;
    svg.style.maxWidth = 'none';
  }
}

export function markdownAction(event: React.SyntheticEvent<HTMLDivElement>) {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement)) return;
  const frame = select.closest<HTMLElement>('.markdown-frame');
  if (!frame || !select.value) return;
  const action = select.value;
  select.selectedIndex = 0;
  void run(frame, action).catch(() =>
    toast.error(`Could not complete “${action}”.`)
  );
}
