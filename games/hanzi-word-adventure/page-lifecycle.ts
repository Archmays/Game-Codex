import { bindInputLifecycle } from '../../packages/ui/input';

/** Suspend transient work while retaining the complete journey and its local save. */
export function bindAdventureLifecycle(options: {
  root: HTMLElement; resetInput: () => void; suspend: () => void;
  resume: () => void; persist: () => void; destroy: () => void;
}) {
  let destroyed = false;
  const stopInputs = bindInputLifecycle(options.root, options.resetInput);
  const visibility = () => {
    if (destroyed) return;
    options.resetInput();
    if (document.hidden) options.suspend(); else options.resume();
  };
  const pagehide = (event: PageTransitionEvent) => {
    if (destroyed) return;
    options.suspend(); options.persist();
    if (!event.persisted) options.destroy(); else options.resetInput();
  };
  const pageshow = (event: PageTransitionEvent) => {
    if (!destroyed && event.persisted && !document.hidden) { options.resetInput(); options.resume(); }
  };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', pagehide);
  window.addEventListener('pageshow', pageshow);
  return {
    destroy() {
      if (destroyed) return; destroyed = true; stopInputs();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pagehide);
      window.removeEventListener('pageshow', pageshow);
    }
  };
}
