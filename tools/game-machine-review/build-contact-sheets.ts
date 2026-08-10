import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import type { RouteEvidenceRecord } from "./collect-route-evidence";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function renderContactSheet(records: readonly RouteEvidenceRecord[], outputPath: string): string {
  const screenshots = records.flatMap((record) => record.screenshotFiles.map((file) => ({ record, file })));
  if (screenshots.length === 0) throw new Error("A contact sheet requires real screenshot evidence");
  const outputDirectory = dirname(resolve(outputPath));
  const cards = screenshots.map(({ record, file }) => {
    const source = relative(outputDirectory, resolve(file)).replaceAll("\\", "/");
    return `<figure><img src="${escapeHtml(source)}" alt="${escapeHtml(`${record.routeId} ${record.state} ${record.viewport}`)}"><figcaption><strong>${escapeHtml(record.routeId)}</strong><span>${escapeHtml(record.state)} · ${escapeHtml(record.viewport)}</span><code>${escapeHtml(file)}</code></figcaption></figure>`;
  }).join("\n");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Machine Review Contact Sheet</title><style>
*{box-sizing:border-box}body{margin:0;padding:24px;color:#e9f6f2;background:#071c2a;font-family:system-ui,sans-serif}h1{margin:0 0 20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}figure{margin:0;overflow:hidden;border:1px solid #31565d;border-radius:14px;background:#102f37}img{display:block;width:100%;height:auto;background:#000}figcaption{display:grid;gap:4px;padding:12px}span,code{overflow-wrap:anywhere;color:#b9d7d1;font-size:12px}
</style></head><body><h1>Machine Review Contact Sheet</h1><main class="grid">${cards}</main></body></html>`;
}

export function writeContactSheet(records: readonly RouteEvidenceRecord[], outputPath: string): string {
  const html = renderContactSheet(records, outputPath);
  mkdirSync(dirname(resolve(outputPath)), { recursive: true });
  writeFileSync(resolve(outputPath), html, "utf8");
  return outputPath;
}
