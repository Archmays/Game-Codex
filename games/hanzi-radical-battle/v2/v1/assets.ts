import type { AbilityId, GoldenCharacterId } from "../golden-slice/content/types";

export const HANZI_MAGIC_V1_RUNTIME_ASSET_MANIFEST_VERSION = "hanzi-magic-v2-v1-theme-c-assets-1" as const;

export type V1RuntimeAssetRole = "camp-before" | "camp-repaired" | "hero" | "companion" | "monster" | "boss" | "ability" | "meaning-magic" | "spellbook" | "treasure" | "portal";

export interface V1RuntimeAsset {
  readonly id: `A${number}`;
  readonly fileName: string;
  readonly role: V1RuntimeAssetRole;
  readonly sha256: string;
  readonly source: "theme-c-batch-01-selected" | "v1-imagegen-selected";
  readonly characterId?: GoldenCharacterId;
  readonly abilityId?: AbilityId;
}

export const HANZI_MAGIC_V1_RUNTIME_ASSETS: readonly V1RuntimeAsset[] = [
  { id: "A1", fileName: "A01-camp-before.png", role: "camp-before", sha256: "848C8AD88C2AF42817F6CC6A894F93BD89EEEE3B8636724D7F0CA1BA822AF9A4", source: "theme-c-batch-01-selected" },
  { id: "A2", fileName: "A02-camp-repaired.png", role: "camp-repaired", sha256: "433A7587B9E199A28FD8EB71DFB725916ADD4E86DCD833675CB305D0685F1B3F", source: "theme-c-batch-01-selected" },
  { id: "A3", fileName: "A03-mage.png", role: "hero", sha256: "63165023E4341916DD4FCAC730D3A1B974E55B91E98C71A0E51FB9B9106F1BAA", source: "theme-c-batch-01-selected" },
  { id: "A4", fileName: "A04-companion.png", role: "companion", sha256: "9D4CD48F10C425C15325B50144F27824E83FBBAF3A207B56C7CDC5A31EC7906A", source: "theme-c-batch-01-selected" },
  { id: "A5", fileName: "A05-common-monster.png", role: "monster", sha256: "B609F0057316E88977C67758433CC26BB1B7B0D4903D0BE67A20DD3AB1844E61", source: "theme-c-batch-01-selected" },
  { id: "A6", fileName: "A06-two-phase-boss.png", role: "boss", sha256: "A8F9552C91AA4D39FE362FC53069D0099E146F63E78A9B8F008238102B16F0BB", source: "theme-c-batch-01-selected" },
  { id: "A7", fileName: "A07-guardian-light.png", role: "ability", abilityId: "guardian-light", sha256: "AADA68BE071E0EA5B094BF7ACACCE36C84D34E32814EFEF2AC49564D63C10B85", source: "theme-c-batch-01-selected" },
  { id: "A8", fileName: "A08-star-path.png", role: "ability", abilityId: "star-path", sha256: "A4ACB3BF4AE20596EE6DC8B8043399500F3A685738272FB863C2B3CA7B5C339C", source: "theme-c-batch-01-selected" },
  { id: "A9", fileName: "A09-ink-echo.png", role: "ability", abilityId: "ink-echo", sha256: "E4D3B68BE7FF537E9BAB97EB8D0A8F04FE022F403510B24B6A73BBB1CEA83278", source: "theme-c-batch-01-selected" },
  { id: "A10", fileName: "A10-ming-magic.png", role: "meaning-magic", characterId: "ming", sha256: "39085985000ABDC004C0F66FCBFFC5FE537AA5539FD4101129B8D018EF72FA9E", source: "theme-c-batch-01-selected" },
  { id: "A11", fileName: "A11-hua-magic.png", role: "meaning-magic", characterId: "hua", sha256: "B6536361BAA36D6B61BC070D68EDCE3B518DA5951A89D657B08804615932BDE9", source: "theme-c-batch-01-selected" },
  { id: "A12", fileName: "A12-lin-magic.png", role: "meaning-magic", characterId: "lin", sha256: "4A3ACB1CD4AF3907C098E1DEDA34B60F2733BE9A0B11D4B4359938D5621776D8", source: "theme-c-batch-01-selected" },
  { id: "A13", fileName: "A13-xing-magic.png", role: "meaning-magic", characterId: "xing", sha256: "E1DAE1B50850CDF598F16EFF2EC1ED58553FF614C959627AA00105C511A9B559", source: "theme-c-batch-01-selected" },
  { id: "A14", fileName: "A14-spellbook.png", role: "spellbook", sha256: "2448AB340B3148BF74929953EB1B63DB7791F82B37C68961DE5474C11CDB8C64", source: "theme-c-batch-01-selected" },
  { id: "A15", fileName: "A15-treasure-box.png", role: "treasure", sha256: "B89DD09FF724025A1635EF87C8CD22836CA31EA00BE923D779D9300B808015C4", source: "theme-c-batch-01-selected" },
  { id: "A16", fileName: "A16-world-portal.png", role: "portal", sha256: "90F16CF5FDA54D6B3C0ED3726DA6EAFE47C4234C143A33029E03F9E24F0B05BA", source: "theme-c-batch-01-selected" },
  { id: "A17", fileName: "A17-cao-magic.png", role: "meaning-magic", characterId: "cao", sha256: "A16F81E7FBFB9A67374FCDCF1AD06501B4B28BADD52B4090937018DF15988E9A", source: "v1-imagegen-selected" },
  { id: "A18", fileName: "A18-kan-magic.png", role: "meaning-magic", characterId: "kan", sha256: "6B1DCBDD53901091B67236287055FEE027A3F1AC00427A0C870D65122A2C1E70", source: "v1-imagegen-selected" },
  { id: "A19", fileName: "A19-yuan-magic.png", role: "meaning-magic", characterId: "yuan", sha256: "D34AE724633040FE861AE1E2324456BACD27CD4731514531E0D145194B8E3A3A", source: "v1-imagegen-selected" },
  { id: "A20", fileName: "A20-hui-magic.png", role: "meaning-magic", characterId: "hui", sha256: "770DE51A39A4F0C4619137D5DFB4A62AFC607B2C32C8E7DBE63397B5D7A8F03C", source: "v1-imagegen-selected" },
  { id: "A21", fileName: "A21-bao-magic.png", role: "meaning-magic", characterId: "bao", sha256: "D950BBB60450F77F10F0E3D4C4AE055707BEE0B353422772133D5D74E67D48AD", source: "v1-imagegen-selected" },
  { id: "A22", fileName: "A22-feng-magic.png", role: "meaning-magic", characterId: "feng", sha256: "7A8ABAE1FDFC4E25BF32286E5EAC98AE5E17B710C2830A2317A73FD4D2E7C596", source: "v1-imagegen-selected" },
  { id: "A23", fileName: "A23-mao-magic.png", role: "meaning-magic", characterId: "mao", sha256: "1F05A6D8A56F65578337641B8ACB5337CFC679ECE0DCAD764DCB6B0844B2BDE1", source: "v1-imagegen-selected" },
  { id: "A24", fileName: "A24-pao-magic.png", role: "meaning-magic", characterId: "pao", sha256: "9D9AC17133A04948D99D739E9F662D0AC66FFE53269081257AE77D7D682110D7", source: "v1-imagegen-selected" },
] as const;

const RAW_APP_BASE_URL = import.meta.env?.BASE_URL ?? "./";
const APP_BASE_URL = RAW_APP_BASE_URL === "/" ? "/" : RAW_APP_BASE_URL.endsWith("/") ? RAW_APP_BASE_URL : `${RAW_APP_BASE_URL}/`;
export const HANZI_MAGIC_V1_ASSET_BASE_URL = `${APP_BASE_URL}assets/hanzi-radical-battle/v2/theme-c/v1/`;

export function v1AssetUrl(asset: V1RuntimeAsset | V1RuntimeAsset["id"]): string {
  const entry = typeof asset === "string" ? HANZI_MAGIC_V1_RUNTIME_ASSETS.find((item) => item.id === asset) : asset;
  if (!entry) throw new Error(`Unknown V1 runtime asset: ${asset}`);
  return `${HANZI_MAGIC_V1_ASSET_BASE_URL}${entry.fileName}`;
}

export function v1MeaningAssetUrl(characterId: GoldenCharacterId): string {
  const entry = HANZI_MAGIC_V1_RUNTIME_ASSETS.find((item) => item.role === "meaning-magic" && item.characterId === characterId);
  if (!entry) throw new Error(`Missing V1 meaning asset for ${characterId}`);
  return v1AssetUrl(entry);
}
