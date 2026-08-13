import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const root = resolve(process.cwd());
const assetDirectory = resolve(root, "public/assets/hanzi-radical-battle/v2/theme-c/v1");
const output = resolve(root, "artifacts/hanzi-radical-battle-v2/v1-release/contact-sheet.webp");
const files = [
  "A01-camp-before.png", "A02-camp-repaired.png", "A03-mage.png", "A04-companion.png",
  "A05-common-monster.png", "A06-two-phase-boss.png", "A07-guardian-light.png", "A08-star-path.png",
  "A09-ink-echo.png", "A10-ming-magic.png", "A11-hua-magic.png", "A12-lin-magic.png",
  "A13-xing-magic.png", "A14-spellbook.png", "A15-treasure-box.png", "A16-world-portal.png",
  "A17-cao-magic.png", "A18-kan-magic.png", "A19-yuan-magic.png", "A20-hui-magic.png",
  "A21-bao-magic.png", "A22-feng-magic.png", "A23-mao-magic.png", "A24-pao-magic.png",
];

const width = 1200;
const cellWidth = 200;
const cellHeight = 190;
const header = 68;
const composites = [];

for (const [index, file] of files.entries()) {
  const row = Math.floor(index / 6);
  const column = index % 6;
  const bytes = await readFile(resolve(assetDirectory, file));
  const image = await sharp(bytes).resize(166, 142, { fit: "contain", background: { r: 7, g: 32, b: 42, alpha: 0 } }).png().toBuffer();
  composites.push({ input: image, left: column * cellWidth + 17, top: header + row * cellHeight + 8 });
  const label = Buffer.from(`<svg width="${cellWidth}" height="32"><rect width="100%" height="100%" fill="#082a34"/><text x="100" y="21" text-anchor="middle" fill="#ffe09a" font-size="15" font-family="Arial, sans-serif">${basename(file, ".png")}</text></svg>`);
  composites.push({ input: label, left: column * cellWidth, top: header + row * cellHeight + 152 });
}

const title = Buffer.from(`<svg width="${width}" height="${header}"><rect width="100%" height="100%" fill="#061b27"/><text x="34" y="34" fill="#ffe09a" font-size="24" font-family="Arial, sans-serif">Hanzi Magic Battle V2 · V1.0.0 · Theme C Runtime Assets · 24/24</text><text x="34" y="55" fill="#8ce8cf" font-size="13" font-family="Arial, sans-serif">A1–A16 frozen Theme C selection · A17–A24 V1 ImageGen selection · transparent checkerboard review surface</text></svg>`);
const checker = Buffer.from(`<svg width="${width}" height="${header + 4 * cellHeight}"><defs><pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#173945"/><rect width="10" height="10" fill="#204b56"/><rect x="10" y="10" width="10" height="10" fill="#204b56"/></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>`);
await mkdir(dirname(output), { recursive: true });
await sharp(checker).composite([{ input: title, left: 0, top: 0 }, ...composites]).webp({ quality: 88 }).toFile(output);
const outputBytes = await readFile(output);
const identity = { path: output.replaceAll("\\", "/"), bytes: outputBytes.byteLength, sha256: createHash("sha256").update(outputBytes).digest("hex").toUpperCase(), assets: files };
await writeFile(`${output}.json`, `${JSON.stringify(identity, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(identity)}\n`);
