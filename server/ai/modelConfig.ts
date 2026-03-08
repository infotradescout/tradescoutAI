export const GEMINI_MODEL_DEFAULT = "gemini-1.5-flash";

const KNOWN_BAD_MODEL_NAMES = new Set([
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash",
  "gemini-3.1-pro",
]);

const GEMINI_MODEL_FALLBACKS_DEFAULT = [
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro",
  "gemini-1.5-pro-latest",
  "gemini-2.0-flash",
  "gemini-2.0-flash-exp",
  "gemini-2.5-flash",
];

function splitModels(raw: string | undefined): string[] {
  return String(raw || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function isSupportedCandidate(modelName: string): boolean {
  const normalized = modelName.trim().toLowerCase();
  if (!normalized) return false;
  if (KNOWN_BAD_MODEL_NAMES.has(normalized)) return false;
  if (/^gemini-3\./.test(normalized)) return false;
  return true;
}

function sanitizeModels(models: string[]): string[] {
  return models.filter(isSupportedCandidate);
}

export function getGeminiModelName(): string {
  const configured = sanitizeModels(splitModels(process.env.GEMINI_MODEL));
  return configured[0] || GEMINI_MODEL_DEFAULT;
}

export function getGeminiModelCandidates(): string[] {
  const configured = sanitizeModels(splitModels(process.env.GEMINI_MODEL));
  const envFallbacks = sanitizeModels(splitModels(process.env.GEMINI_MODEL_FALLBACKS));
  const combined = [...configured, ...envFallbacks, ...GEMINI_MODEL_FALLBACKS_DEFAULT];
  return Array.from(new Set(combined));
}

export function getVertexGeminiModelName(): string {
  const configured = String(process.env.GOOGLE_VERTEX_GEMINI_MODEL || "").trim();
  return configured || getGeminiModelName();
}
