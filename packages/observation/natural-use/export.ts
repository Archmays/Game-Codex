import {
  OBSERVATION_FORMAT,
  OBSERVATION_MAX_RECORDS,
  OBSERVATION_RETENTION_DAYS,
  OBSERVATION_SCHEMA_VERSION,
  type NaturalUseObservationBundle,
  type NaturalUseObservationRecord,
} from "./types";
import { localDateString, recordsIntegrityPayload, sha256Hex, validateObservationRecord } from "./schema";
import { PLAY_SURFACE_BY_ID } from "../../data/playSurfaceManifest";

export interface ObservationExportPreview {
  readonly recordCount: number;
  readonly earliestDate: string | null;
  readonly latestDate: string | null;
  readonly distinctSurfaces: number;
  readonly optionalNoteCount: number;
}

export function createObservationExportPreview(records: readonly NaturalUseObservationRecord[]): ObservationExportPreview {
  const dates = records.map((record) => record.dateLocal).sort();
  return {
    recordCount: records.length,
    earliestDate: dates.at(0) ?? null,
    latestDate: dates.at(-1) ?? null,
    distinctSurfaces: new Set(records.map((record) => record.surfaceId)).size,
    optionalNoteCount: records.filter((record) => Boolean(record.note)).length,
  };
}

export async function createObservationBundle(
  records: readonly NaturalUseObservationRecord[],
  projectBuildCommit: string,
  exportedAt = new Date(),
): Promise<NaturalUseObservationBundle> {
  if (!/^[a-f0-9]{40}$/.test(projectBuildCommit) && projectBuildCommit !== "local-source") throw new Error("Project build commit is invalid.");
  if (records.some((record) => !PLAY_SURFACE_BY_ID.has(record.surfaceId))) throw new Error("Observation contains an unknown play surface.");
  if (records.length > OBSERVATION_MAX_RECORDS) throw new Error("Observation export exceeds the record limit.");
  const copied = records.map((record) => {
    const validated = validateObservationRecord(record);
    return { ...validated, tags: [...validated.tags] };
  });
  return {
    format: OBSERVATION_FORMAT,
    version: OBSERVATION_SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    projectBuildCommit,
    retentionDays: OBSERVATION_RETENTION_DAYS,
    maxRecords: OBSERVATION_MAX_RECORDS,
    recordCount: copied.length,
    records: copied,
    integrity: { algorithm: "SHA-256", recordsSha256: await sha256Hex(recordsIntegrityPayload(copied)) },
  };
}

export function serializeObservationBundle(bundle: NaturalUseObservationBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

export function observationBundleFilename(now = new Date()): string {
  return `GAME_CODEX_NATURAL_USE_OBSERVATIONS_${localDateString(now)}.json`;
}
