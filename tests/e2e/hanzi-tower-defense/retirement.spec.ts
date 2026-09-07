import { expect, test } from "@playwright/test";
import { RETIRED_LANGUAGE_PLAY_IDS, RETIRED_LANGUAGE_WORLD_IDS } from "../../../src/app-route";

const originals = {
  "family-games/hanzi-magic-complete/v3": '{ "schemaVersion":99,"synthetic":"keep raw" }',
  "family-games/english-world/v2": '{"version":99,"synthetic":"keep raw"}',
  "family-games/equation-slider/progress": '{"saveVersion":99,"synthetic":"keep raw"}',
  "family-games/make-target/progress": '{"version":99,"synthetic":"keep raw"}',
  "family-games/math-world/v1": '{"version":99,"synthetic":"keep raw"}',
  "synthetic/unrelated": "unchanged bytes  \n",
};
test("retired bookmarks clear conflicting state, protect raw saves, and never fetch an old engine", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  const errors: string[] = [], retiredRequests: string[] = [];
  page.on("pageerror", e=>errors.push(e.message));
  page.on("request", r=>{if(/\/(?:games\/(?:hanzi-radical|english-spell|pinyin-magic)|assets\/(?:english-world|hanzi-radical))/.test(new URL(r.url()).pathname))retiredRequests.push(r.url());});
  await page.goto("/"); await expect(page.getByTestId("my-game-world")).toBeVisible();
  await page.evaluate(values=>Object.entries(values).forEach(([k,v])=>localStorage.setItem(k,v)), originals);
  for(const [key, ids] of [["play",RETIRED_LANGUAGE_PLAY_IDS],["world",RETIRED_LANGUAGE_WORLD_IDS]] as const) for(const id of ids) {
    await page.goto(`/?${key}=${id}&view=archive&chapter=2&mode=word&hub=classic&station=slider#old`);
    await expect(page.getByTestId("my-game-world")).toBeVisible();
    await expect(page).toHaveURL(/\?world=my-game-world&notice=retired-language$/);
    await expect(page.locator(".world-stage .world-entry")).toHaveCount(2);
    await expect(page.locator("canvas")).toHaveCount(0);
  }
  for(const station of ["slider","target"]) {
    await page.goto(`/?world=math-world&station=${station}`);
    await expect(page.locator(station==="slider"?".equation-slider":".make-target-game")).toBeVisible();
    await page.getByRole("button",{name:"← 回城市地图"}).click(); await expect(page.getByTestId("math-world-map")).toBeVisible();
  }
  expect(await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(originals))).toEqual(originals);
  expect(errors).toEqual([]); expect(retiredRequests).toEqual([]);
});
