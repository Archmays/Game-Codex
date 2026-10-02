import Phaser from 'phaser';
import { FONT_STACK } from './content';
import { AdventureScene, type SceneView } from './scene';

/** Own fonts, canvas sizing and the renderer; the DOM world remains usable on failure. */
export function createAdventureSceneBridge(options: { board: HTMLElement; canvas: HTMLElement; view: () => SceneView; failed: () => void }) {
  let game: Phaser.Game | undefined;
  let scene: AdventureScene | undefined;
  let destroyed = false, paused = document.hidden, started = false;
  const sync = (from?: number) => { if (!destroyed) scene?.sync(options.view(), from); };
  const dimensions = () => {
    const ratio = Math.min(devicePixelRatio || 1, 3);
    return { width: Math.round(options.board.clientWidth * ratio), height: Math.round(options.board.clientHeight * ratio) };
  };
  const resize = () => {
    if (!game || destroyed) return;
    const { width, height } = dimensions(); if (width < 1 || height < 1) return;
    if (game.scale.width !== width || game.scale.height !== height) game.scale.resize(width, height);
    sync();
  };
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(options.board);
  window.addEventListener('resize', resize);
  return {
    sync, resize,
    suspend() { paused = true; game?.loop.sleep(); },
    resume() { paused = false; if (!destroyed) { game?.loop.wake(); resize(); sync(); } },
    start() {
      if (destroyed || started) return; started = true;
      void (async () => {
        await document.fonts.ready;
        await document.fonts.load(`32px ${FONT_STACK}`, '人友木林不家门风水开吹山路日月明影');
        if (destroyed) return;
        const { width, height } = dimensions(); if (width < 1 || height < 1) { options.failed(); return; }
        scene = new AdventureScene(() => { if (destroyed) return; options.canvas.dataset.ready = 'true'; sync(); });
        game = new Phaser.Game({ type: Phaser.CANVAS, parent: options.canvas, width, height, transparent: true, scene, banner: false, audio: { noAudio: true }, input: { keyboard: false, mouse: false, touch: false }, scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER } });
        if (paused) game.loop.sleep();
        resize();
      })().catch(() => { if (!destroyed) options.failed(); });
    },
    destroy() {
      if (destroyed) return; destroyed = true;
      resizeObserver.disconnect(); window.removeEventListener('resize', resize);
      game?.destroy(true); game = undefined; scene = undefined;
    }
  };
}
