export function readPositiveIntegerEnv(name: string, fallback: number): number {
  const safeFallback = Number.isFinite(fallback) && fallback > 0 ? Math.floor(fallback) : 1;
  const raw = String(process.env[name] ?? "").trim();
  if (!raw) return safeFallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return safeFallback;
  return parsed;
}
