import { CollageBand } from "./CollageBand";
import { COLOR_COLLAGE_STRIPS } from "./storyBackgrounds";

/**
 * Browse-by-color collapsed-row atmosphere: spectrum face strips as one
 * static collage band (same stature; title overlay from the section shell).
 */
export function ColorCollageBackground() {
  return <CollageBand strips={COLOR_COLLAGE_STRIPS} testId="jw-color-collage" version="face-7" />;
}
