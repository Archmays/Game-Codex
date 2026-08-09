import type { Step06ObservationDocument } from "./observation-model";
import { validateStep06Observation } from "./observation-schema";

export const STEP06_OBSERVATION_FILENAME = "STEP-06_SECOND_USE_OBSERVATION.json";

export function serializeStep06Observation(observation: Step06ObservationDocument): string {
  if (!validateStep06Observation(observation)) throw new Error("Refusing invalid STEP 06 observation export");
  return `${JSON.stringify(observation, null, 2)}\n`;
}

export function downloadStep06Observation(observation: Step06ObservationDocument): void {
  const blob = new Blob([serializeStep06Observation(observation)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = STEP06_OBSERVATION_FILENAME;
  link.click();
  URL.revokeObjectURL(url);
}
