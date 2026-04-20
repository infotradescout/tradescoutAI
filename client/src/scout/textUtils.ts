/**
 * textUtils.ts
 *
 * Shared text normalization and scoring utilities used by Scout's
 * local intent handlers and message builders.
 */

/**
 * Normalize a string for fuzzy matching: lowercase, collapse non-alphanumeric
 * to spaces, trim.
 */
export function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compute a Jaccard-based token overlap score between a query and a candidate
 * string.  Returns a value in [0, 0.98].
 *
 * - Exact substring match → 0.98
 * - Token overlap (Jaccard) weighted with a small length boost
 */
export function tokenOverlapScore(query: string, candidate: string): number {
  const q = normalizeForMatch(query);
  const c = normalizeForMatch(candidate);
  if (!q || !c) return 0;
  if (c.includes(q)) return 0.98;

  const qTokens = new Set(q.split(" ").filter(Boolean));
  const cTokens = new Set(c.split(" ").filter(Boolean));
  if (qTokens.size === 0 || cTokens.size === 0) return 0;

  let intersect = 0;
  qTokens.forEach((t) => {
    if (cTokens.has(t)) intersect += 1;
  });
  const union = qTokens.size + cTokens.size - intersect;
  const jaccard = union > 0 ? intersect / union : 0;

  // Penalize very short / generic queries
  const lengthBoost = Math.min(1, q.length / 12);
  return Math.max(0, Math.min(0.95, jaccard * 0.9 + lengthBoost * 0.1));
}
