export const GEMINI_MODEL_DEFAULT = "gemini-3.0-flash";

const ALLOWED_GEMINI_MODELS = new Set([
  "gemini-3.0-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-pro",
]);

const KNOWN_BAD_MODEL_NAMES = new Set(["gemini-3.0-flash-exp", "gemini-2.0-flash-exp"]);

const GEMINI_MODEL_FALLBACKS_DEFAULT = [
  "gemini-3.0-flash",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
];

function splitModels(raw: string | undefined): string[] {
  return String(raw || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function readBoolEnv(name: string): boolean {
  const raw = String(process.env[name] || "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function isAllowedGeminiModel(modelName: string): boolean {
  if (ALLOWED_GEMINI_MODELS.has(modelName)) return true;
  return readBoolEnv("GEMINI_MODEL_ALLOW_UNLISTED");
}

function normalizeCandidate(modelName: string): string | null {
  const normalized = modelName
    .trim()
    .toLowerCase()
    .replace(/^models\//, "");
  if (!normalized) return null;
  if (KNOWN_BAD_MODEL_NAMES.has(normalized)) return null;
  if (!isAllowedGeminiModel(normalized)) return null;
  return normalized;
}

function sanitizeModels(models: string[]): string[] {
  return models.map(normalizeCandidate).filter((value): value is string => Boolean(value));
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
  const normalized = normalizeCandidate(configured);
  return normalized || getGeminiModelName();
}
