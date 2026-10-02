import { spellingLetters } from './model';
import type { StudyContext } from './study-context';
export function createSpellingView(ctx: StudyContext) {
function stopSpelling(): void {
    if (ctx.spellTimer) clearTimeout(ctx.spellTimer); ctx.spellTimer = 0; ctx.spellingPlaying = false;
    ctx.setText('[data-es-spell-play]', '▶ 看拼写');
  }
function updateSpelling(): void {
    const buttons = [...ctx.el('[data-es-word-letters]').querySelectorAll<HTMLButtonElement>('button')];
    buttons.forEach((button, index) => { button.classList.toggle('es-current-letter', index === ctx.spellStep); button.classList.toggle('es-done-letter', index < ctx.spellStep); });
    ctx.setText('[data-es-spell-status]', `${ctx.spellStep + 1} / ${buttons.length}`);
    ctx.el<HTMLButtonElement>('[data-es-spell-prev]').disabled = ctx.spellStep === 0;
    ctx.el<HTMLButtonElement>('[data-es-spell-next]').disabled = ctx.spellStep >= buttons.length - 1;
  }
function renderSpelling(): void {
    const host = ctx.el('[data-es-word-letters]'); host.replaceChildren();
    spellingLetters(ctx.selectedWord).forEach((char, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.lang = 'en'; button.textContent = char;
      button.setAttribute('aria-label', `第 ${index + 1} 个字符 ${char}，回看写法`);
      button.addEventListener('click', () => ctx.openReview(char, button, false), ctx.opts); host.append(button);
    });
    ctx.updateSpelling();
  }
return {stopSpelling,updateSpelling,renderSpelling};
}
export function bindSpellingView(ctx: StudyContext):void {
  ctx.listen('[data-es-spell-prev]', () => { ctx.stopSpelling(); ctx.spellStep = Math.max(0, ctx.spellStep - 1); ctx.updateSpelling(); });
  ctx.listen('[data-es-spell-next]', () => { ctx.stopSpelling(); ctx.spellStep = Math.min(spellingLetters(ctx.selectedWord).length - 1, ctx.spellStep + 1); ctx.updateSpelling(); });
  ctx.listen('[data-es-spell-play]', () => {
    if (ctx.spellingPlaying) { ctx.stopSpelling(); return; }
    ctx.pauseWriting(); ctx.spellingPlaying = true; ctx.spellStep = 0; ctx.updateSpelling(); ctx.setText('[data-es-spell-play]', 'Ⅱ 暂停拼写');
    const tick = (): void => {
      if (!ctx.spellingPlaying) return;
      if (ctx.spellStep >= spellingLetters(ctx.selectedWord).length - 1) { ctx.stopSpelling(); return; }
      ctx.spellStep++; ctx.updateSpelling(); ctx.spellTimer = window.setTimeout(tick, 950);
    };
    ctx.spellTimer = window.setTimeout(tick, 950);
  });
}
