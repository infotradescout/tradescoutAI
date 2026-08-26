import { CollageBand } from "./CollageBand";
import { MATERIAL_COLLAGE_STRIPS } from "./storyBackgrounds";

/**
 * Browse-by-material collapsed-row atmosphere: distinct material faces rather
 * than one slab. The shared band keeps these below-fold images lazy.
 */
export function MaterialCollageBackground() {
  return (
    <CollageBand
      strips={MATERIAL_COLLAGE_STRIPS}
      testId="jw-material-collage"
      version="material-faces-1"
    />
  );
}
