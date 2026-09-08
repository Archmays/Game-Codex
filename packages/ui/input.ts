/** Shared focus/lifecycle helpers only. Games own their semantic actions and direction rules. */
export function editableTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]');
}

export function ignoreGameKey(event: KeyboardEvent, context: HTMLElement, allowRepeat = false): boolean {
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey || (!allowRepeat && event.repeat)) return true;
  if (!(event.target instanceof Element) || !context.contains(event.target) || editableTarget(event.target)) return true;
  // Native activation belongs to its button/link, never also to the underlying game.
  return (event.key === ' ' || event.key === 'Enter') && !!event.target.closest('button, a[href], summary, [role="button"]');
}

/** All exits of a held input/gesture use the same reset; does not resume a paused game. */
export function bindInputLifecycle(root: HTMLElement, reset: (event?: Event) => void): () => void {
  const hidden = () => { if (document.hidden) reset(); };
  const composing = (event: KeyboardEvent) => {
    if (editableTarget(event.target)) return;
    if ((event.isComposing || event.keyCode === 229 || event.repeat) && (event.key === ' ' || event.key === 'Enter')) event.preventDefault();
  };
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', hidden);
  root.addEventListener('pointercancel', reset);
  root.addEventListener('keydown', composing, true);
  return () => {
    reset(); window.removeEventListener('blur', reset); document.removeEventListener('visibilitychange', hidden);
    root.removeEventListener('pointercancel', reset); root.removeEventListener('keydown', composing, true);
  };
}

export interface RovingOptions {
  items: string;
  /** Grid columns, computed at key time so orientation changes remain usable. Omit for a list. */
  columns?: () => number;
}

/** One Tab stop per region; arrows/Home/End navigate enabled items. Call refresh after rendering. */
export function rovingGroup(root: HTMLElement, options: RovingOptions) {
  const allItems = () => [...root.querySelectorAll<HTMLElement>(options.items)].filter(e => !e.closest('[hidden], [inert]'));
  const items = () => allItems().filter(e => !e.matches(':disabled'));
  let current = 0;
  const refresh = () => {
    const list = items();
    const focused = list.indexOf(document.activeElement as HTMLElement);
    if (focused >= 0) current = focused;
    current = Math.min(current, Math.max(0, list.length - 1));
    allItems().filter(e => e.matches(':disabled')).forEach(e => { e.tabIndex = -1; });
    list.forEach((e, i) => { e.tabIndex = i === current ? 0 : -1; });
  };
  const focusin = (event: FocusEvent) => {
    const list = items(), index = list.indexOf(event.target as HTMLElement);
    if (index >= 0) { current = index; refresh(); }
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || editableTarget(event.target)) return;
    const list = items(), index = list.indexOf(event.target as HTMLElement);
    if (index < 0 || !list.length) return;
    const columns = Math.max(1, options.columns?.() ?? 1);
    const delta = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns } as Record<string, number>)[event.key];
    if (delta === undefined && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    if (event.key === 'Home') current = 0;
    else if (event.key === 'End') current = list.length - 1;
    else {
      const all = allItems(), start = all.indexOf(list[index]);
      current = index;
      for (let step = 1; step <= all.length; step++) {
        const candidate = all[((start + delta * step) % all.length + all.length) % all.length];
        if (list.includes(candidate)) { current = list.indexOf(candidate); break; }
      }
    }
    list.forEach((e, i) => { e.tabIndex = i === current ? 0 : -1; });
    list[current].focus();
  };
  root.addEventListener('focusin', focusin); root.addEventListener('keydown', keydown);
  refresh();
  return { refresh, destroy() { root.removeEventListener('focusin', focusin); root.removeEventListener('keydown', keydown); } };
}

/** Preserve focus only when a render actually replaces the focused node in this region. */
export function preserveRegionFocus(root: HTMLElement, render: () => void, key: (e: HTMLElement) => string | null, find: (id: string) => HTMLElement | null, fallback?: () => HTMLElement | null): void {
  const active = document.activeElement as HTMLElement | null;
  const id = active && root.contains(active) ? key(active) : null;
  render();
  if (id !== null && active && !active.isConnected) (find(id) ?? fallback?.())?.focus({ preventScroll: true });
}
