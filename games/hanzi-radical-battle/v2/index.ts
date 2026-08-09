import "./styles.css";
import { mountPilotOverlay, type PilotOverlayHandle, type PilotOverlayOptions } from "./ui/PilotOverlay";

export function mountHanziV2CoreSpellPilot(
  root: HTMLElement,
  options?: PilotOverlayOptions,
): PilotOverlayHandle {
  return mountPilotOverlay(root, options);
}

export * from "./content/candidate-characters";
export * from "./content/pilot-scenarios";
export * from "./content/visual-directions";
export * from "./save/schema";
export * from "./simulation/pilot-machine";
export * from "./simulation/structure-board";
