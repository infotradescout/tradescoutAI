import { pool } from "../db";

const u32 = (n: number) => n >>> 0;

// Simple deterministic string hash -> two 32-bit ints for pg_advisory_lock(int,int).
function hashToTwoInts(key: string): [number, number] {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;

  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = u32(Math.imul(h1 ^ c, 0x01000193));
    h2 = u32(Math.imul(h2 + c, 0x27d4eb2d));
  }

  // Fit into signed 32-bit integers for postgres int.
  const a = (h1 | 0) as number;
  const b = (h2 | 0) as number;
  return [a, b];
}

export async function withAdvisoryLock<T>(
  lockKey: string,
  fn: () => Promise<T>
): Promise<T | null> {
  const [a, b] = hashToTwoInts(lockKey);

  const lockRes = await pool.query("select pg_try_advisory_lock($1::int, $2::int) as locked", [
    a,
    b,
  ]);
  const locked = Boolean(lockRes?.rows?.[0]?.locked);
  if (!locked) {
    return null;
  }

  try {
    return await fn();
  } finally {
    try {
      await pool.query("select pg_advisory_unlock($1::int, $2::int)", [a, b]);
    } catch {
      // Best-effort.
    }
  }
}
