export type PageMode = "game-fullscreen" | "adult-tool" | "document";

export const PAGE_MODE_CLASS: Readonly<Record<PageMode, string>> = {
  "game-fullscreen": "game-fullscreen-page",
  "adult-tool": "adult-tool-page",
  document: "document-page",
};

interface PageModeClassList {
  add(...tokens: string[]): void;
  remove(...tokens: string[]): void;
}

export interface PageModeDocument {
  readonly documentElement: { readonly classList: PageModeClassList };
  readonly body: { readonly classList: PageModeClassList };
}

const PAGE_MODE_CLASSES = Object.values(PAGE_MODE_CLASS);

function activeDocument(): PageModeDocument {
  if (typeof document === "undefined") throw new Error("Page mode requires a document");
  return document;
}

export function resetPageMode(target: PageModeDocument = activeDocument()): void {
  target.documentElement.classList.remove(...PAGE_MODE_CLASSES);
  target.body.classList.remove(...PAGE_MODE_CLASSES);
}

export function activatePageMode(mode: PageMode, target: PageModeDocument = activeDocument()): void {
  resetPageMode(target);
  const className = PAGE_MODE_CLASS[mode];
  target.documentElement.classList.add(className);
  target.body.classList.add(className);
}
