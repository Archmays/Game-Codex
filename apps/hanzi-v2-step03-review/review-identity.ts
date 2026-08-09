import {
  GOLDEN_ABILITIES,
  GOLDEN_BOSS_PHASES,
  GOLDEN_SLICE_ENCOUNTERS,
  GOLDEN_SLICE_MANIFEST_REVISION_HASH,
  GOLDEN_SLICE_MANIFEST_VERSION,
  THEME_C_ASSET_MANIFEST_VERSION,
  THEME_C_PROCEDURAL_ASSETS,
} from "../../games/hanzi-radical-battle/v2/golden-slice/content";
import { createRevisionHash } from "../../games/hanzi-radical-battle/v2/content/revision-hash";

export const STEP03_REVIEW_ROUTE = "?review=hanzi-v2-step03";
export const GOLDEN_SLICE_PREVIEW_ROUTE = "?play=hanzi-v2-golden-slice";
export const GOLDEN_SLICE_REVIEW_ROUTE = "?play=hanzi-v2-golden-slice&mode=review";
export const STEP03_IMPLEMENTATION_REVIEW_VERSION = "hanzi-v2-step03-runtime-v1";
export const STEP03_PARENT_REVIEW_CONTRACT_VERSION = "hanzi-v2-step03-parent-contract-v2";

export const STEP03_REVIEW_IDENTITY = {
  schemaVersion: 2,
  reviewContractVersion: STEP03_PARENT_REVIEW_CONTRACT_VERSION,
  initiativeId: "hanzi-radical-battle-v2",
  technicalState: "GOLDEN_SLICE_CANDIDATE_READY_FOR_PARENT_REVIEW",
  implementationReviewVersion: STEP03_IMPLEMENTATION_REVIEW_VERSION,
  goldenSliceManifestVersion: GOLDEN_SLICE_MANIFEST_VERSION,
  goldenSliceManifestRevisionHash: GOLDEN_SLICE_MANIFEST_REVISION_HASH,
  previewRoute: GOLDEN_SLICE_REVIEW_ROUTE,
  selectedTheme: "C",
  sourceSnapshots: {
    encounters: createRevisionHash("step03-review-encounters", GOLDEN_SLICE_ENCOUNTERS),
    abilities: createRevisionHash("step03-review-abilities", GOLDEN_ABILITIES),
    boss: createRevisionHash("step03-review-boss", GOLDEN_BOSS_PHASES),
    themeC: createRevisionHash("step03-review-theme-c", {
      version: THEME_C_ASSET_MANIFEST_VERSION,
      assets: THEME_C_PROCEDURAL_ASSETS,
      reviewSeedPreviewSha256: {
        "C-CAMP-01.webp": "6917449D5A863E874125172AD4C79E2B8F11AD42A856711952A449962F5B95A2",
        "C-CHARACTERS-01.webp": "D1164C6C0C43713E9D17DD888DF316F842BB2236CEE70AB04E81625333076C19",
        "C-ABILITIES-01.webp": "D4DFA806803D7558A826AFA067E9DEE0939730A26A1843AA777C2AD47DB99305",
      },
    }),
  },
} as const;
