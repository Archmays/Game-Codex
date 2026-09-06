import { expect, type Page, type Locator } from "@playwright/test";
import { ENGLISH_V2_WORD_BY_ID } from "../../../games/english-spell-battle/v2/content/manifest";
import { PILOT_SENTENCES, type PilotTaskId } from "../../../games/english-spell-battle/v2/pilot/model";

export function pilotActivate(page: Page, input: "click" | "keyboard" | "tap" = "click") {
  return async (locator: Locator) => {
    if (input === "keyboard") { await locator.focus(); await page.keyboard.press("Enter"); }
    else if (input === "tap") await locator.tap();
    else await locator.click();
  };
}
export async function buildPilotWord(page: Page, id: PilotTaskId, input: "click" | "keyboard" | "tap" = "click") {
  const activate = pilotActivate(page, input);
  await activate(page.locator('[data-pilot-action="spelling"]'));
  for (const unit of ENGLISH_V2_WORD_BY_ID.get(id)!.graphemeUnits) await activate(page.locator(`[data-tile-id$=":${unit.id}"]`));
  await activate(page.locator('[data-action="check-build"]'));
  await expect(page.locator(".pilot-spelling")).toHaveCount(0);
}
export async function applyCanonicalPilot(page: Page, id: PilotTaskId, input: "click" | "keyboard" | "tap" = "click") {
  const activate = pilotActivate(page, input);
  await activate(page.locator(`[data-pilot-word="${id.slice(5)}"]`));
  for (const objectId of id === "word-two" ? ["A", "C"] : [id === "word-run" || id === "word-jump" ? "B" : "A"])
    await activate(page.locator(`[data-pilot-object="${objectId}"]`));
  await activate(page.locator('[data-pilot-action="execute"]'));
  await expect(page.getByTestId("pilot-current").locator("p")).toHaveText(PILOT_SENTENCES[id]);
  await expect(page.getByTestId("english-mission")).toHaveAttribute("data-interaction-complete", "true");
}
