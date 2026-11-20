export function locate(id: string) {
  const target = document.querySelector<HTMLElement>(`#${CSS.escape(id)}`);

  if (!target) {
    return false;
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  target.scrollIntoView({
    behavior: reduced ? 'auto' : 'smooth',
    block: 'nearest',
  });
  target.focus({ preventScroll: true });
  target.removeAttribute('data-located');
  target.getBoundingClientRect();
  target.setAttribute('data-located', '');

  return true;
}
