import { validateStep07Observation } from "./observation-schema";
import type { Step07ObservationDocument } from "./observation-model";

export function downloadStep07Observation(document: Step07ObservationDocument): void {
  if (!validateStep07Observation(document)) throw new Error("STEP 07 observation failed schema or privacy validation");
  const blob = new Blob([`${JSON.stringify(document, null, 2)}\n`], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = href;
  anchor.download = document.evidenceKind === "SYNTHETIC_TOOLING_TEST_ONLY"
    ? "STEP-07_SYNTHETIC_TOOLING_TEST_OBSERVATION.json"
    : "STEP-07_REAL_SECOND_USE_OBSERVATION.json";
  anchor.click();
  URL.revokeObjectURL(href);
}
