// Deterministic weekly rotation: the same picks for every visitor all week,
// changing on the Monday boundary -- not a per-visitor/per-render shuffle.
// Kept side-effect-free (no DOM/React) so it's testable without a browser
// environment and reusable anywhere a "featured this week" pick is needed.

export function getIsoWeekMondayKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const isoDay = d.getUTCDay() || 7; // Sunday (0) -> 7
  d.setUTCDate(d.getUTCDate() - isoDay + 1); // Monday of this week
  return d.toISOString().slice(0, 10);
}

export function hashSeedString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return hash;
}

export function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeeklyRandomStones<T extends { slug: string }>(
  stones: T[],
  count: number,
  now: Date = new Date()
): T[] {
  if (stones.length === 0) return [];
  const seed = hashSeedString(getIsoWeekMondayKey(now));
  const rng = mulberry32(seed);
  const shuffled = [...stones];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
