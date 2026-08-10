import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

export type NetworkRequestPolicy = "SAME_ORIGIN_ALLOWED" | "EXTERNAL_NETWORK_FORBIDDEN";

export interface ClassifiedNetworkRequest {
  readonly url: string;
  readonly method: string;
  readonly policy: NetworkRequestPolicy;
}

export interface RouteEvidenceRecord {
  readonly schemaVersion: 1;
  readonly routeId: string;
  readonly route: string;
  readonly state: string;
  readonly viewport: string;
  readonly isolatedContext: true;
  readonly syntheticStorage: true;
  readonly screenshotFiles: readonly string[];
  readonly ariaFiles: readonly string[];
  readonly traceFiles: readonly string[];
  readonly eventFiles: readonly string[];
  readonly consoleErrors: readonly string[];
  readonly pageErrors: readonly string[];
  readonly networkRequests: readonly ClassifiedNetworkRequest[];
}

export interface EvidenceArtifact<T = unknown> {
  readonly label: string;
  readonly path: string;
  readonly value: T;
}

function normalizedEvidencePath(path: string, workspaceRoot = process.cwd()): string {
  const absolute = isAbsolute(path) ? path : resolve(workspaceRoot, path);
  return relative(workspaceRoot, absolute).replaceAll("\\", "/");
}

export function classifyNetworkRequest(urlValue: string, pageOrigin: string, method = "GET"): ClassifiedNetworkRequest {
  let policy: NetworkRequestPolicy = "EXTERNAL_NETWORK_FORBIDDEN";
  try {
    const url = new URL(urlValue, pageOrigin);
    if (["data:", "blob:"].includes(url.protocol) || url.origin === new URL(pageOrigin).origin) policy = "SAME_ORIGIN_ALLOWED";
  } catch {
    policy = "EXTERNAL_NETWORK_FORBIDDEN";
  }
  return { url: urlValue, method, policy };
}

export function collectRouteEvidence(input: Omit<RouteEvidenceRecord, "schemaVersion">): RouteEvidenceRecord {
  if (!input.routeId.trim() || !input.route.trim() || !input.state.trim() || !input.viewport.trim()) throw new Error("Route evidence identity is incomplete");
  if (input.isolatedContext !== true || input.syntheticStorage !== true) throw new Error("Machine review evidence must use an isolated context and synthetic storage");
  const evidenceFiles = [...input.screenshotFiles, ...input.ariaFiles, ...input.traceFiles, ...input.eventFiles];
  if (evidenceFiles.length === 0 || evidenceFiles.some((path) => !path.trim())) throw new Error("Route evidence must cite at least one evidence file");
  return {
    schemaVersion: 1,
    ...input,
    screenshotFiles: input.screenshotFiles.map((path) => normalizedEvidencePath(path)),
    ariaFiles: input.ariaFiles.map((path) => normalizedEvidencePath(path)),
    traceFiles: input.traceFiles.map((path) => normalizedEvidencePath(path)),
    eventFiles: input.eventFiles.map((path) => normalizedEvidencePath(path)),
  };
}

export function readJsonEvidence<T = unknown>(path: string, label: string): EvidenceArtifact<T> {
  const normalizedPath = normalizedEvidencePath(path);
  let value: T;
  try {
    value = JSON.parse(readFileSync(resolve(path), "utf8")) as T;
  } catch (error) {
    throw new Error(`Unable to read ${label} evidence at ${normalizedPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { label, path: normalizedPath, value };
}

export function externalRequests(records: readonly RouteEvidenceRecord[]): ClassifiedNetworkRequest[] {
  return records.flatMap((record) => record.networkRequests).filter((request) => request.policy === "EXTERNAL_NETWORK_FORBIDDEN");
}
