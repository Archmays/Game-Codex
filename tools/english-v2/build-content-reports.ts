import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGLISH_V2_CANDIDATE_POOL, LEGACY_ENGLISH_AUDIT, LEGACY_LEVEL_LABEL_DISPOSITION } from "../../games/english-spell-battle/v2/content/legacy-audit";
import { ENGLISH_V2_SENTENCES, ENGLISH_V2_SUPPORT_MANIFEST, ENGLISH_V2_WORDS } from "../../games/english-spell-battle/v2/content/manifest";
import { ENGLISH_V2_SOURCES } from "../../games/english-spell-battle/v2/content/sources";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const releaseDir = resolve(root, "docs/english-v2/release");
const assetDir = resolve(root, "public/assets/english-world/words");
mkdirSync(releaseDir, { recursive: true });

const GENERATION_IDS: Readonly<Record<string, string>> = {
  cat: "exec-2d502394-2b75-451e-b202-fa1ee3bb46b5", fish: "exec-d9fdc070-cd3c-4158-a560-a26e02b63e95", cake: "exec-6feb813c-a93f-42da-8eae-77df3901fffd", milk: "exec-aa9ec33a-9443-4d15-96d4-dece3500e6b5", run: "exec-13c6d891-f02f-4f01-8f1c-512b7115cd03",
  dog: "exec-f36c3c2c-1080-4b0c-ad58-0fa1b744b84e", pig: "exec-d7fe8069-4b1d-4c93-9c7c-3aa4ec3bfa31", cow: "exec-b62b90f9-6038-476c-a9cf-cc0120eff9b7", duck: "exec-f82e8983-df2a-47fd-a846-ec24e8f50799", bear: "exec-1a8e4907-8f7d-44da-b9e9-522fe81e0102", rabbit: "exec-cd52dc3b-2d04-4047-9539-d51ee9f1318c", frog: "exec-2823af63-3836-4404-9223-ae9c6cb6f5f6", tiger: "exec-602ffee5-b242-4d2e-a0e4-70ea80dfc7a8", horse: "exec-cfb3013f-0b3d-42f0-93e6-1f3111eacde2", bee: "exec-7f748749-e955-4f6a-bf6a-e7f3b27a02d8", goat: "exec-510b6223-612f-4d32-84c8-0688d52f520c",
  dad: "exec-2d300958-4791-4fa0-9067-bf28691973a3", mom: "exec-90acd23b-b7dd-48b7-9e3e-19377c41fe7b", baby: "exec-64ed9553-998a-4826-a215-7ff827e7dea3", boy: "exec-c75d2b7e-f508-4a46-a85e-ab911e2b28e8", girl: "exec-5091e4e8-d332-44ec-a49e-a47da191f73f", teacher: "exec-654726ad-99c1-4a98-9730-1e4f90cc5e9d", friend: "exec-da184de3-482c-4feb-9949-b875acf0db32", family: "exec-f84a00d0-aa67-4d63-bc1c-2ae62f35f9d1", book: "exec-3bc8e791-666f-4038-a5c9-9ad50ef47178",
  apple: "exec-d223ae2b-fe7f-484c-9e2b-d5b80a941303", banana: "exec-ba87bc79-fb93-45d9-b9dc-2d36c4326422", egg: "exec-4d62dd13-e6b3-40a0-a7b3-3ef10e1c56dc", water: "exec-017b74b5-b7b3-44eb-97b6-c2dca93dde75", bread: "exec-122b8140-a0d1-4bc8-bbec-2648b6be1f3a", rice: "exec-e830e527-25b4-4cf9-bb59-ff67658feb2d", corn: "exec-191d3f23-c886-4f13-ac1a-daf3efdbd486",
  jump: "exec-3bde229c-bf61-4965-88f3-35623bfd5c47", walk: "exec-566b3f76-ea65-4774-9317-d9ade3697213", sit: "exec-5298c527-f4f4-48f0-80b1-6c433b35cf2e", sleep: "exec-712586ba-825d-459b-bfbe-cc0cedb5d936", eat: "exec-653be622-5698-4895-a7cd-d76a6b3e6bef", drink: "exec-060f41eb-ce18-4f47-866a-4d40890d9a03", sing: "exec-eb31f881-8a9a-469a-8903-b7cd7a8e6420", clap: "exec-9acc6683-4684-47e2-bf74-cc39a0e75bd7",
};

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const assetManifest = ENGLISH_V2_WORDS.map((word) => {
  if (word.visualKind !== "asset") return {
    wordId: word.id,
    lemma: word.lemma,
    visualKind: word.visualKind,
    representation: word.visualKind === "color" ? `CSS color field: ${word.lemma}` : word.imageBrief,
    source: "project-authored-runtime-visual",
  };
  const path = resolve(assetDir, `${word.lemma}.webp`);
  return {
    wordId: word.id,
    lemma: word.lemma,
    visualKind: "asset",
    runtimePath: `public/assets/english-world/words/${word.lemma}.webp`,
    bytes: statSync(path).size,
    sha256: sha256(path),
    sourceGenerationId: GENERATION_IDS[word.lemma],
    generator: "OpenAI image generation tool",
    promptProfile: "[ChatGPT image] Original 1:1 transparent watercolor/gouache child vocabulary illustration; no text, logo, emoji, brand, reward motif, opaque background, or real-child identity.",
    subjectBrief: word.imageBrief,
    licenseBoundary: "Original project-generated runtime asset; no third-party product expression copied.",
  };
});

if (Object.keys(GENERATION_IDS).length !== 40 || assetManifest.filter((asset) => asset.visualKind === "asset").length !== 40) throw new Error("Expected 40 generated asset identities");

writeJson(resolve(root, "public/assets/english-world/asset-manifest.json"), {
  schemaVersion: 1,
  generatedAt: "2026-08-22",
  imagePolicy: { maxBytes: 204800, dimensions: "640x640", format: "WebP with alpha", promptOwner: "ChatGPT image" },
  assets: assetManifest,
});
writeJson(resolve(releaseDir, "WORD-GRAPH.json"), { schemaVersion: 1, words: ENGLISH_V2_WORDS, sentences: ENGLISH_V2_SENTENCES, supportWords: ENGLISH_V2_SUPPORT_MANIFEST });
writeJson(resolve(releaseDir, "LEGACY-AUDIT.json"), { schemaVersion: 1, baselineCount: 44, audit: LEGACY_ENGLISH_AUDIT, unsupportedLevelLabel: LEGACY_LEVEL_LABEL_DISPOSITION });
writeJson(resolve(releaseDir, "CANDIDATE-POOL.json"), { schemaVersion: 1, candidateCount: ENGLISH_V2_CANDIDATE_POOL.length, selectedCount: ENGLISH_V2_CANDIDATE_POOL.filter((item) => item.selected).length, candidates: ENGLISH_V2_CANDIDATE_POOL });
writeJson(resolve(releaseDir, "SOURCE-LEDGER.json"), { schemaVersion: 1, sources: ENGLISH_V2_SOURCES });

process.stdout.write(`English V2 reports: PASS (${ENGLISH_V2_WORDS.length} words, ${ENGLISH_V2_SENTENCES.length} sentences, ${assetManifest.length} visuals).\n`);
