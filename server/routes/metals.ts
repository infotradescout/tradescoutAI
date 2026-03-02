import { Router } from "express";
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { metalsPortfolioTransactions } from "../../shared/schema";
import { ensureFreshMetalsPriceSnapshot, isSnapshotStale } from "../services/metalsPricingService";
import { computeMetalsPortfolioSummary } from "../services/metalsPortfolioMath";

export const metalsRouter = Router();

function getUserId(req: any): string {
  return String((req.user as any)?.claims?.sub || (req.user as any)?.id || "").trim();
}

function toPublicSnapshot(snapshot: any) {
  return {
    id: snapshot.id,
    asOf: snapshot.asOf instanceof Date ? snapshot.asOf.toISOString() : String(snapshot.asOf),
    source: snapshot.source,
    baseCurrency: snapshot.baseCurrency,
    pricesUsdPerOz: {
      XAU: snapshot.xauUsdPerOz != null ? Number(snapshot.xauUsdPerOz) : null,
      XAG: snapshot.xagUsdPerOz != null ? Number(snapshot.xagUsdPerOz) : null,
      XPT: snapshot.xptUsdPerOz != null ? Number(snapshot.xptUsdPerOz) : null,
      XPD: snapshot.xpdUsdPerOz != null ? Number(snapshot.xpdUsdPerOz) : null,
    },
  };
}

metalsRouter.get("/api/metals/prices", async (req, res) => {
  const maxAgeMs = 15 * 60 * 1000;

  const result = await ensureFreshMetalsPriceSnapshot({
    maxAgeMs,
    waitForFresh: true,
  });

  if (!result.snapshot) {
    return res.status(503).json({
      message: "Metals prices are not available yet.",
      hint: "Default provider is free (GoldPrice.org). Optionally set METALS_PRICE_PROVIDER=metals_api with METALS_API_KEY for an alternative source.",
    });
  }

  const stale = isSnapshotStale(result.snapshot, maxAgeMs);
  res.json({
    snapshot: toPublicSnapshot(result.snapshot),
    stale,
    refreshed: result.refreshed,
    refreshInFlight: result.refreshInFlight,
    refreshCadenceMinutes: 15,
  });
});

const createTransactionSchema = z.object({
  direction: z.enum(["buy", "sell"]),
  metalCode: z
    .string()
    .trim()
    .min(2)
    .max(8)
    .transform((v) => v.toUpperCase()),
  metalName: z.string().trim().min(1).max(64).optional(),
  quantityOz: z.number().finite().positive(),
  totalUsd: z.number().finite().nonnegative(),
  executedAt: z.string().trim().optional(), // ISO or YYYY-MM-DD
  notes: z.string().trim().max(4000).optional(),
});

function parseExecutedAt(value?: string): Date {
  if (!value) return new Date();
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map((n) => Number(n));
    const date = new Date(Date.UTC(y, m - 1, d));
    if (Number.isFinite(date.getTime())) return date;
  }
  const parsed = new Date(trimmed);
  if (!Number.isFinite(parsed.getTime())) return new Date();
  return parsed;
}

async function getMetalHoldingsOz(userId: string, metalCode: string): Promise<number> {
  const rows = await db
    .select()
    .from(metalsPortfolioTransactions)
    .where(
      and(
        eq(metalsPortfolioTransactions.userId, userId),
        eq(metalsPortfolioTransactions.metalCode, metalCode)
      )
    )
    .orderBy(asc(metalsPortfolioTransactions.executedAt))
    .limit(2000);

  let holdings = 0;
  for (const row of rows) {
    const qty = Number(row.quantityOz);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    holdings += row.direction === "sell" ? -qty : qty;
  }
  return holdings;
}

metalsRouter.get("/api/metals/portfolio/transactions", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const rows = await db
    .select()
    .from(metalsPortfolioTransactions)
    .where(eq(metalsPortfolioTransactions.userId, userId))
    .orderBy(
      desc(metalsPortfolioTransactions.executedAt),
      desc(metalsPortfolioTransactions.createdAt)
    )
    .limit(500);

  res.json({
    transactions: rows.map((row: any) => ({
      ...row,
      quantityOz: Number(row.quantityOz),
      totalUsd: Number(row.totalUsd),
      executedAt:
        row.executedAt instanceof Date ? row.executedAt.toISOString() : String(row.executedAt),
    })),
  });
});

metalsRouter.post("/api/metals/portfolio/transactions", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const body = createTransactionSchema.parse(req.body ?? {});

  // Physical-only + USD-only: USD amounts are accepted as user-entered totals (no other currencies supported).
  if (body.direction === "sell") {
    const holdings = await getMetalHoldingsOz(userId, body.metalCode);
    if (body.quantityOz > holdings + 1e-9) {
      return res.status(400).json({
        message: "Insufficient holdings to record a sell transaction.",
        holdingsOz: holdings,
      });
    }
  }

  const executedAt = parseExecutedAt(body.executedAt);
  const now = new Date();

  const [created] = await db
    .insert(metalsPortfolioTransactions)
    .values({
      userId,
      direction: body.direction,
      metalCode: body.metalCode,
      metalName: body.metalName || null,
      quantityOz: body.quantityOz.toFixed(6),
      totalUsd: body.totalUsd.toFixed(2),
      executedAt,
      notes: body.notes || null,
      createdAt: now,
      updatedAt: now,
    } as any)
    .returning();

  res.status(201).json({
    transaction: {
      ...created,
      quantityOz: Number(created.quantityOz),
      totalUsd: Number(created.totalUsd),
      executedAt:
        created.executedAt instanceof Date
          ? created.executedAt.toISOString()
          : String(created.executedAt),
    },
  });
});

metalsRouter.delete(
  "/api/metals/portfolio/transactions/:id",
  isAuthenticated,
  async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "id required" });

    const rows = await db
      .delete(metalsPortfolioTransactions)
      .where(
        and(eq(metalsPortfolioTransactions.id, id), eq(metalsPortfolioTransactions.userId, userId))
      )
      .returning({ id: metalsPortfolioTransactions.id });

    if (rows.length === 0) return res.status(404).json({ message: "Transaction not found" });
    res.json({ ok: true });
  }
);

metalsRouter.get("/api/metals/portfolio/summary", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const txRows = await db
    .select()
    .from(metalsPortfolioTransactions)
    .where(eq(metalsPortfolioTransactions.userId, userId))
    .orderBy(
      asc(metalsPortfolioTransactions.executedAt),
      asc(metalsPortfolioTransactions.createdAt)
    )
    .limit(2500);

  const priceResult = await ensureFreshMetalsPriceSnapshot({
    maxAgeMs: 15 * 60 * 1000,
    waitForFresh: false,
  });
  const prices = priceResult.snapshot
    ? {
        XAU:
          priceResult.snapshot.xauUsdPerOz != null
            ? Number(priceResult.snapshot.xauUsdPerOz)
            : null,
        XAG:
          priceResult.snapshot.xagUsdPerOz != null
            ? Number(priceResult.snapshot.xagUsdPerOz)
            : null,
        XPT:
          priceResult.snapshot.xptUsdPerOz != null
            ? Number(priceResult.snapshot.xptUsdPerOz)
            : null,
        XPD:
          priceResult.snapshot.xpdUsdPerOz != null
            ? Number(priceResult.snapshot.xpdUsdPerOz)
            : null,
      }
    : {};

  const summary = computeMetalsPortfolioSummary(
    txRows.map((row: any) => ({
      direction: row.direction,
      metalCode: row.metalCode,
      quantityOz: Number(row.quantityOz),
      totalUsd: Number(row.totalUsd),
      executedAtMs:
        row.executedAt instanceof Date
          ? row.executedAt.getTime()
          : new Date(row.executedAt).getTime(),
    })),
    prices as any
  );

  res.json({
    summary,
    pricesUsdPerOz: prices,
    priceAsOf: priceResult.snapshot?.asOf
      ? priceResult.snapshot.asOf instanceof Date
        ? priceResult.snapshot.asOf.toISOString()
        : String(priceResult.snapshot.asOf)
      : null,
  });
});
