import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import {
  HANZI_MAGIC_V1_ADVENTURES,
  HANZI_MAGIC_V1_AUTHORIZATION_ID,
  HANZI_MAGIC_V1_CHARACTERS,
  HANZI_MAGIC_V1_CONTENT_REVISION,
  HANZI_MAGIC_V1_ENCOUNTERS,
  HANZI_MAGIC_V1_GAME_VERSION,
} from "../games/hanzi-radical-battle/v2/golden-slice/content/adventures";
import { HANZI_MAGIC_V1_RUNTIME_ASSETS } from "../games/hanzi-radical-battle/v2/v1/assets";

const root = resolve(import.meta.dirname, "..");
const expectedIds = ["ming", "hua", "lin", "xing", "cao", "kan", "yuan", "hui", "bao", "feng", "mao", "pao"];
const expectedPinyin = ["míng", "huā", "lín", "xīng", "cǎo", "kàn", "yuán", "huí", "bāo", "fēng", "māo", "pǎo"];

describe("Hanzi Magic Battle V2 V1 content integrity", () => {
  it("binds the exact authorization, version, 12 characters, and three fixed adventures", () => {
    expect(HANZI_MAGIC_V1_AUTHORIZATION_ID).toBe("HUMAN_AUTHORIZED_SKIP_REAL_SECOND_USE_AND_COMPLETE_V1_ONE_SHOT_01");
    expect(HANZI_MAGIC_V1_GAME_VERSION).toBe("V1.0.0");
    expect(HANZI_MAGIC_V1_CONTENT_REVISION).toMatch(/^fnv1a:/);
    expect(HANZI_MAGIC_V1_CHARACTERS.map((character) => character.id)).toEqual(expectedIds);
    expect(HANZI_MAGIC_V1_ADVENTURES).toHaveLength(3);
    expect(HANZI_MAGIC_V1_ADVENTURES.map((adventure) => adventure.characterIds)).toEqual([
      ["ming", "hua", "lin", "xing"], ["cao", "kan", "yuan", "hui"], ["bao", "feng", "mao", "pao"],
    ]);
    expect(HANZI_MAGIC_V1_ENCOUNTERS).toHaveLength(12);
    expect(HANZI_MAGIC_V1_ENCOUNTERS.every((encounter) => encounter.cards.length === 5)).toBe(true);
    expect(HANZI_MAGIC_V1_CHARACTERS.some((character) => ["qing-clear", "qing-sunny", "song"].includes(character.id))).toBe(false);
  });

  it("keeps accepted learning fields complete and contains no etymology claim", () => {
    expect(HANZI_MAGIC_V1_CHARACTERS.map((character) => character.pinyin)).toEqual(expectedPinyin);
    for (const character of HANZI_MAGIC_V1_CHARACTERS) {
      expect(character.glyph).toHaveLength(1);
      expect(character.familiarWord.length).toBeGreaterThanOrEqual(2);
      expect(character.shortMeaning).toBeTruthy();
      expect(character.components.length).toBeGreaterThanOrEqual(2);
      expect(character.spokenPhrase).toContain(character.glyph);
      expect(character.etymologyClaim).toBeNull();
      expect(character.meaningAssetId).toMatch(/^A(?:1[0-3]|1[7-9]|2[0-4])$/);
    }
  });

  it("uses truthful child-visible position forms and enclosure structures", () => {
    const byId = Object.fromEntries(HANZI_MAGIC_V1_CHARACTERS.map((character) => [character.id, character]));
    expect(byId.kan.components).toEqual(expect.arrayContaining([expect.objectContaining({ glyph: "龵", sourceGlyph: "手", slotId: "top" })]));
    expect(byId.pao.components).toEqual(expect.arrayContaining([expect.objectContaining({ glyph: "⻊", sourceGlyph: "足", slotId: "left" })]));
    expect(byId.yuan.structure).toBe("full-enclosure");
    expect(byId.hui.components.map((component) => component.glyph)).toEqual(["囗", "口"]);
    expect(byId.bao.structure).toBe("semi-enclosure");
    expect(byId.feng.structure).toBe("semi-enclosure");
    expect(byId.lin.components.map((component) => component.id)).toEqual(["lin-mu-left", "lin-mu-right"]);
  });

  it("binds all 24 production assets to runtime files and SHA-256", () => {
    expect(HANZI_MAGIC_V1_RUNTIME_ASSETS).toHaveLength(24);
    expect(new Set(HANZI_MAGIC_V1_RUNTIME_ASSETS.map((asset) => asset.id)).size).toBe(24);
    expect(HANZI_MAGIC_V1_RUNTIME_ASSETS.filter((asset) => asset.role === "meaning-magic")).toHaveLength(12);
    for (const asset of HANZI_MAGIC_V1_RUNTIME_ASSETS) {
      const path = join(root, "public", "assets", "hanzi-radical-battle", "v2", "theme-c", "v1", asset.fileName);
      expect(existsSync(path), path).toBe(true);
      expect(asset.sha256).toMatch(/^[A-F0-9]{64}$/);
      expect(createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase()).toBe(asset.sha256);
    }
  });
});
