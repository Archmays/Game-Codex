import { type WordLayout } from './letter-strokes';
import { Shelf, STARTER_WORDS } from './model';
import { WritingPlayer } from './writing-player';
import type { BoardView } from './writing-board';

export function createStudyContext(root:HTMLElement) {
  const abort = new AbortController();
  const opts = { signal: abort.signal };
  const shelf = new Shelf({ getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) });
  let results = STARTER_WORDS;
  let selectedWord = '';
  let spellStep = 0;
  let spellTimer = 0;
  let spellingPlaying = false;
  let wordPlayer: WritingPlayer | null = null;
  let reviewPlayer: WritingPlayer | null = null;
  let wordBoards: BoardView[] = [];
  let wordLayout: WordLayout | null = null;
  let reviewBoards: BoardView[] = [];
  let reviewMode = false;
  let standaloneReview = false;
  let reviewLetter = 'a';
  let wordOpener: HTMLElement | null = null;
  let reviewOpener: HTMLElement | null = null;
  let announcedState = '';
  let ghostVisible = true;
  const el = <T extends Element = HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const setText = (selector: string, value: string): void => { el(selector).textContent = value; };
  const listen = (selector: string, fn: (event: Event) => void): void => el(selector).addEventListener('click', fn, opts);
  const activePlayer = (): WritingPlayer | null => ctx.reviewMode ? ctx.reviewPlayer : ctx.wordPlayer;
  const activeBoards = (): BoardView[] => ctx.reviewMode ? ctx.reviewBoards : ctx.wordBoards;
const ctx={
root,
abort,
opts,
shelf,
results,
selectedWord,
spellStep,
spellTimer,
spellingPlaying,
wordPlayer: wordPlayer as WritingPlayer | null,
reviewPlayer: reviewPlayer as WritingPlayer | null,
wordBoards: wordBoards as BoardView[],
wordLayout: wordLayout as WordLayout | null,
reviewBoards: reviewBoards as BoardView[],
reviewMode,
standaloneReview,
reviewLetter,
wordOpener: wordOpener as HTMLElement | null,
reviewOpener: reviewOpener as HTMLElement | null,
announcedState,
ghostVisible,el,setText,listen,activePlayer,activeBoards,
get dialog(){return el<HTMLDialogElement>('[data-es-word-dialog]');},
get input(){return el<HTMLInputElement>('#es-input');},
renderResults(): void  { throw Error('Unbound study action: renderResults'); },
renderShelf(): void  { throw Error('Unbound study action: renderShelf'); },
refreshZoom(): void  { throw Error('Unbound study action: refreshZoom'); },
syncUi(): void  { throw Error('Unbound study action: syncUi'); },
cancelFrame(): void  { throw Error('Unbound study action: cancelFrame'); },
startFrame(): void  { throw Error('Unbound study action: startFrame'); },
pauseWriting(): void  { throw Error('Unbound study action: pauseWriting'); },
stopSpelling(): void  { throw Error('Unbound study action: stopSpelling'); },
updateSpelling(): void  { throw Error('Unbound study action: updateSpelling'); },
renderSpelling(): void  { throw Error('Unbound study action: renderSpelling'); },
updateFavorite(): void  { throw Error('Unbound study action: updateFavorite'); },
openWord(word: string, opener: HTMLElement): void  { throw Error('Unbound study action: openWord'); },
openReview(char: string, opener: HTMLElement, standalone: boolean): void  { throw Error('Unbound study action: openReview'); },
renderReview(): void  { throw Error('Unbound study action: renderReview'); },
closeDialog(): void  { throw Error('Unbound study action: closeDialog'); },
returnFromReview(): void  { throw Error('Unbound study action: returnFromReview'); },
speak(): void  { throw Error('Unbound study action: speak'); }
};return ctx;
}
export type StudyContext=ReturnType<typeof createStudyContext>;
