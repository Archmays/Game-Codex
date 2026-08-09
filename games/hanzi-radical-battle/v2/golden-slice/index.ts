import "./styles.css";
import {
  mountGoldenSliceOverlay,
  type GoldenSliceOverlayHandle,
  type GoldenSliceOverlayOptions,
} from "./ui/GoldenSliceOverlay";

export function mountHanziV2GoldenSlice(
  root: HTMLElement,
  options?: GoldenSliceOverlayOptions,
): GoldenSliceOverlayHandle {
  return mountGoldenSliceOverlay(root, options);
}

export * from "./content";
export * from "./save";
export * from "./simulation";
