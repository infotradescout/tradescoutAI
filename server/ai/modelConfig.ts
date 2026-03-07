export const GEMINI_MODEL_DEFAULT = "gemini-3.1-flash-lite";

export function getGeminiModelName(): string {
  const configured = String(process.env.GEMINI_MODEL || "").trim();
  return configured || GEMINI_MODEL_DEFAULT;
}

export function getVertexGeminiModelName(): string {
  const configured = String(process.env.GOOGLE_VERTEX_GEMINI_MODEL || "").trim();
  return configured || getGeminiModelName();
}
