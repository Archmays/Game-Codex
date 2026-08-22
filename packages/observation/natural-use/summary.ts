import type { NaturalUseObservationBundle, ObservationTag } from "./types";
import { PLAY_SURFACE_BY_ID } from "../../data/playSurfaceManifest";

const FRICTION_TAGS = new Set<ObservationTag>([
  "hesitated", "needed-light-help", "needed-substantial-help", "feedback-unclear", "control-missed", "left-before-finish", "technical-glitch",
]);

export function summarizeObservationBundle(bundle: NaturalUseObservationBundle) {
  const tagCounts: Record<string, number> = {};
  const surfaceTag = new Map<string, { surfaceId: string; surfaceTitle: string; tag: ObservationTag; count: number; dates: Set<string> }>();
  const parentHelpCounts: Record<string, number> = {};
  const outcomeCounts: Record<string, number> = {};
  for (const record of bundle.records) {
    parentHelpCounts[record.parentHelp] = (parentHelpCounts[record.parentHelp] ?? 0) + 1;
    outcomeCounts[record.outcome] = (outcomeCounts[record.outcome] ?? 0) + 1;
    for (const tag of record.tags) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      const key = `${record.surfaceId}\u0000${tag}`;
      const current = surfaceTag.get(key) ?? { surfaceId: record.surfaceId, surfaceTitle: PLAY_SURFACE_BY_ID.get(record.surfaceId)?.title ?? record.surfaceId, tag, count: 0, dates: new Set<string>() };
      current.count += 1;
      current.dates.add(record.dateLocal);
      surfaceTag.set(key, current);
    }
  }
  const surfaceTagCounts = [...surfaceTag.values()].map((entry) => ({ ...entry, dates: [...entry.dates].sort(), distinctDates: entry.dates.size }))
    .sort((left, right) => right.count - left.count || left.surfaceId.localeCompare(right.surfaceId) || left.tag.localeCompare(right.tag));
  return {
    format: "game-codex-natural-use-observation-summary",
    version: 1,
    evidenceBoundary: ["DESCRIPTIVE_ONLY", "NOT_STATISTICAL_VALIDATION", "NOT_CHILD_PROFILE"],
    source: { format: bundle.format, version: bundle.version, recordsSha256: bundle.integrity.recordsSha256 },
    recordCount: bundle.recordCount,
    distinctDates: new Set(bundle.records.map((record) => record.dateLocal)).size,
    distinctSurfaces: new Set(bundle.records.map((record) => record.surfaceId)).size,
    tagCounts,
    surfaceTagCounts,
    parentHelpCounts,
    outcomeCounts,
    repeatedFrictionCandidates: surfaceTagCounts.filter((entry) => FRICTION_TAGS.has(entry.tag) && entry.count >= 2),
    technicalBlockerCandidates: surfaceTagCounts.filter((entry) => entry.tag === "technical-glitch" && entry.count >= 1),
    prohibitedOutputsAbsent: ["engagement-score", "fun-score", "learning-score", "mastery", "retention", "addiction-risk", "child-profile"],
  } as const;
}
