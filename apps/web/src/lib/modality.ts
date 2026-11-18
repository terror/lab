export function watchModality(root: HTMLElement = document.documentElement) {
  const onTab = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    root.dataset.modality = 'keyboard';
  };

  const onPointerDown = () => {
    root.dataset.modality = 'pointer';
  };

  root.dataset.modality = 'pointer';

  window.addEventListener('keydown', onTab, true);
  window.addEventListener('keyup', onTab, true);
  window.addEventListener('pointerdown', onPointerDown, true);

  return () => {
    window.removeEventListener('keydown', onTab, true);
    window.removeEventListener('keyup', onTab, true);
    window.removeEventListener('pointerdown', onPointerDown, true);
    delete root.dataset.modality;
  };
}
