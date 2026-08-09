import { createHash } from "node:crypto";
import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { chromium } from "@playwright/test";

type SeedSpec = {
  readonly promptDocIds: readonly string[];
  readonly category: string;
  readonly sourceName: string;
};

type ConvertedPreview = {
  readonly width: number;
  readonly height: number;
  readonly bytes: Buffer;
};

const repositoryRoot = resolve(import.meta.dirname, "..", "..");
const imagegenRoot = resolve(repositoryRoot, "artifacts/hanzi-radical-battle-v2/step-03/imagegen");
const originalsRoot = resolve(imagegenRoot, "originals");
const previewsRoot = resolve(imagegenRoot, "previews");
const manifestPath = resolve(imagegenRoot, "asset-seed-manifest.json");
const promptDocument = "docs/hanzi-radical-battle-v2/step-03/05-IMAGEGEN-THEME-C-SEED-PROMPTS.md";
const previewQuality = 0.82;
const previewLongestEdge = 1280;

const seeds: readonly SeedSpec[] = [
  {
    promptDocIds: ["C-CAMP-01"],
    category: "camp before-after review concept sheet",
    sourceName: "C-CAMP-01.png",
  },
  {
    promptDocIds: ["C-MAGE-01", "C-COMPANION-01", "C-INK-01", "C-BOSS-01"],
    category: "Theme C character concept contact sheet",
    sourceName: "C-CHARACTERS-01.png",
  },
  {
    promptDocIds: ["C-ABILITIES-01"],
    category: "three neutral ability icon review sheet",
    sourceName: "C-ABILITIES-01.png",
  },
];

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function projectPath(path: string): string {
  return relative(repositoryRoot, path).replaceAll("\\", "/");
}

async function convertToWebp(source: Buffer): Promise<ConvertedPreview> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    const result = await page.evaluate(async ({ sourceBase64, longestEdge, quality }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${sourceBase64}`;
      await new Promise<void>((resolveImage, rejectImage) => {
        image.addEventListener("load", () => resolveImage(), { once: true });
        image.addEventListener("error", () => rejectImage(new Error("ImageGen original could not be decoded.")), { once: true });
      });
      const scale = Math.min(1, longestEdge / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas 2D context was not available for ImageGen preview conversion.");
      context.drawImage(image, 0, 0, width, height);
      return { width, height, dataUrl: canvas.toDataURL("image/webp", quality) };
    }, { sourceBase64: source.toString("base64"), longestEdge: previewLongestEdge, quality: previewQuality });
    if (!result.dataUrl.startsWith("data:image/webp;base64,")) {
      throw new Error("Chromium did not produce a WebP ImageGen preview.");
    }
    const bytes = Buffer.from(result.dataUrl.slice("data:image/webp;base64,".length), "base64");
    if (bytes.subarray(0, 4).toString("ascii") !== "RIFF" || bytes.subarray(8, 12).toString("ascii") !== "WEBP") {
      throw new Error("Generated ImageGen preview does not have a WebP signature.");
    }
    return { width: result.width, height: result.height, bytes };
  } finally {
    await browser.close();
  }
}

await mkdir(previewsRoot, { recursive: true });
const assets = [];
for (const seed of seeds) {
  const sourcePath = resolve(originalsRoot, seed.sourceName);
  const source = await readFile(sourcePath);
  const sourceHash = sha256(source);
  const converted = await convertToWebp(source);
  const previewPath = resolve(previewsRoot, seed.sourceName.replace(/\.png$/i, ".webp"));
  await writeFile(previewPath, converted.bytes);
  const previewOnDisk = await readFile(previewPath);
  const previewStats = await stat(previewPath);
  if (!previewOnDisk.equals(converted.bytes)) throw new Error(`Preview byte verification failed for ${seed.sourceName}.`);
  const sourceAfter = await readFile(sourcePath);
  if (sha256(sourceAfter) !== sourceHash) throw new Error(`Original ImageGen source changed during preview creation: ${seed.sourceName}.`);
  assets.push({
    promptDocument,
    promptDocIds: seed.promptDocIds,
    category: seed.category,
    sourcePath: projectPath(sourcePath),
    sourceSha256: sourceHash,
    sourceBytes: source.length,
    previewPath: projectPath(previewPath),
    previewSha256: sha256(previewOnDisk),
    previewBytes: previewStats.size,
    previewDimensions: { width: converted.width, height: converted.height },
    crop: "fit-contain; no crop",
    longestEdgeTargetPx: previewLongestEdge,
    webpQuality: previewQuality,
    status: "GENERATED_PENDING_PARENT",
    reviewOnly: true,
    runtimeIncluded: false,
  });
}

const manifest = {
  schemaVersion: 1,
  initiativeId: "hanzi-radical-battle-v2",
  generatedAtUtc: new Date().toISOString(),
  previewTool: "Playwright Chromium canvas WebP encoder",
  parentReviewBoundary: "Previews and originals are review-only. They are not child runtime assets or authorization for sprite-strip production.",
  assets,
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\r\n`, "utf8");
console.log(`Created ${assets.length} review-only ImageGen WebP previews and ${projectPath(manifestPath)}.`);
