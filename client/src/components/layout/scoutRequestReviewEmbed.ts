const REQUEST_REVIEW_PATH = "/direct-connect/post";
const FRAME_MARKER = "data-scout-request-review";

/** Only Scout's private request-review work area gets an embedded frame marker. */
export function isScoutRequestReviewWorkAreaUrl(url: string | null): boolean {
  if (!url || !url.startsWith("/") || url.startsWith("//")) return false;
  try {
    const target = new URL(url, "https://tradescout.invalid");
    return target.pathname === REQUEST_REVIEW_PATH && target.searchParams.get("source") === "scout";
  } catch {
    return false;
  }
}

/** A URL flag alone must never remove navigation from a direct page visit. */
export function isEmbeddedScoutRequestReview(
  location: string,
  browserWindow: Window | null = typeof window === "undefined" ? null : window
): boolean {
  if (location.split(/[?#]/, 1)[0] !== REQUEST_REVIEW_PATH || !browserWindow) return false;
  try {
    const frame = browserWindow.frameElement;
    return (
      frame?.tagName === "IFRAME" &&
      frame.getAttribute(FRAME_MARKER) === "true" &&
      browserWindow.parent !== browserWindow &&
      browserWindow.parent.location.origin === browserWindow.location.origin &&
      browserWindow.parent.location.pathname === "/scout"
    );
  } catch {
    return false;
  }
}
