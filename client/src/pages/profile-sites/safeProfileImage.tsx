import type { ImgHTMLAttributes, SyntheticEvent } from "react";

/**
 * Detects truncated/corrupt assets that decode as solid black while still
 * firing onLoad (so onError never runs). Shared by inventory cards and
 * luxury-material-house imagery.
 */
export function isDecodedFrameBlack(img: HTMLImageElement): boolean {
  try {
    const w = 24;
    const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w) || 24);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
    return sum / (data.length / 4) < 4;
  } catch {
    return false;
  }
}

export function advanceImageSrcFallback(
  img: HTMLImageElement,
  images: string[],
  onExhausted?: (img: HTMLImageElement) => void
): void {
  const nextIndex = Number(img.dataset.fallbackIndex || "0") + 1;
  if (nextIndex < images.length) {
    img.dataset.fallbackIndex = String(nextIndex);
    img.src = images[nextIndex];
    return;
  }
  img.onerror = null;
  onExhausted?.(img);
}

export function createFallbackImageHandlers(
  images: string[],
  onExhausted?: (img: HTMLImageElement) => void
) {
  return {
    onError: (event: SyntheticEvent<HTMLImageElement>) => {
      advanceImageSrcFallback(event.currentTarget, images, onExhausted);
    },
    onLoad: (event: SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget;
      if (isDecodedFrameBlack(img)) {
        advanceImageSrcFallback(img, images, onExhausted);
      }
    },
  };
}

type SafeProfileImgProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "onError" | "onLoad"
> & {
  src: string;
  /** Additional candidates after the primary src fails or decodes black. */
  fallbackSrcs?: string[];
  hideWhenExhausted?: boolean;
};

/** Profile-site image with black-frame + onError fallback chaining. */
export function SafeProfileImg({
  src,
  fallbackSrcs = [],
  hideWhenExhausted = true,
  alt = "",
  ...rest
}: SafeProfileImgProps) {
  const images = [src, ...fallbackSrcs].filter((value): value is string => Boolean(value));
  if (images.length === 0) return null;

  const handlers = createFallbackImageHandlers(images, (img) => {
    if (!hideWhenExhausted) return;
    img.removeAttribute("src");
    img.alt = alt ? `${alt} (temporarily unavailable)` : "Photo temporarily unavailable";
    img.style.visibility = "hidden";
  });

  return (
    <img
      src={images[0]}
      alt={alt}
      data-fallback-index="0"
      onError={handlers.onError}
      onLoad={handlers.onLoad}
      {...rest}
    />
  );
}
