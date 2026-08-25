import {
  boxFromNormalized,
  detectSlabFaceBoxFromRaw,
  extractPaletteFromRaw as extractBasePaletteFromRaw,
  safeCenterFaceBox,
} from "./jw-stone-face-color-core-base.mjs";
import { tightenStonePalette } from "./jw-stone-color-bucket-accuracy.mjs";

export { boxFromNormalized, detectSlabFaceBoxFromRaw, safeCenterFaceBox };

export function extractPaletteFromRaw(data, info, options = {}) {
  return tightenStonePalette(extractBasePaletteFromRaw(data, info, options));
}
