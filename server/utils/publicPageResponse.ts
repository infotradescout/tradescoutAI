import type { Response } from "express";

function setNonIndexableHeaders(res: Response): void {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
}

export function sendPublicPageNotFound(res: Response, message = "Public page not found") {
  setNonIndexableHeaders(res);
  return res.status(404).type("text/plain").send(message);
}

export function sendPublicPageRenderFailure(
  res: Response,
  message = "Unable to render public page"
) {
  setNonIndexableHeaders(res);
  return res.status(500).type("text/plain").send(message);
}
