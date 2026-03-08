export const GEMINI_MODEL_DEFAULT = "gemini-2.5-flash";

const GEMINI_MODEL_FALLBACKS_DEFAULT = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

export function getGeminiModelName(): string {
  const configured = String(process.env.GEMINI_MODEL || "").trim();
  return configured || GEMINI_MODEL_DEFAULT;
}

export function getGeminiModelCandidates(): string[] {
  const configured = String(process.env.GEMINI_MODEL || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  const envFallbacks = String(process.env.GEMINI_MODEL_FALLBACKS || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  const combined = [...configured, ...envFallbacks, ...GEMINI_MODEL_FALLBACKS_DEFAULT];
  return Array.from(new Set(combined));
}

export function getVertexGeminiModelName(): string {
  const configured = String(process.env.GOOGLE_VERTEX_GEMINI_MODEL || "").trim();
  return configured || getGeminiModelName();
}
