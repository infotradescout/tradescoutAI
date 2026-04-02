export type PortfolioTx = {
  direction: "buy" | "sell";
  metalCode: string;
  quantityOz: number;
  totalUsd: number;
  executedAtMs?: number;
};

export type PricesUsdPerOz = Partial<Record<string, number | null>>;

type MetalRollup = {
  metalCode: string;
  quantityOz: number;
  costBasisUsd: number;
  realizedUsd: number;
  avgCostUsdPerOz: number | null;
  priceUsdPerOz: number | null;
  marketValueUsd: number | null;
  unrealizedUsd: number | null;
};

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function computeMetalsPortfolioSummary(
  transactions: PortfolioTx[],
  pricesUsdPerOz: PricesUsdPerOz
): {
  metals: MetalRollup[];
  totals: {
    costBasisUsd: number;
    realizedUsd: number;
    marketValueUsd: number | null;
    unrealizedUsd: number | null;
  };
} {
  const grouped = new Map<string, PortfolioTx[]>();
  for (const tx of transactions) {
    const metalCode = String(tx.metalCode || "")
      .trim()
      .toUpperCase();
    if (!metalCode) continue;
    const list = grouped.get(metalCode) ?? [];
    list.push({ ...tx, metalCode });
    grouped.set(metalCode, list);
  }

  const metals: MetalRollup[] = [];

  for (const [metalCode, txs] of grouped.entries()) {
    txs.sort((a, b) => (a.executedAtMs ?? 0) - (b.executedAtMs ?? 0));

    let quantityOz = 0;
    let costBasisUsd = 0;
    let realizedUsd = 0;

    for (const tx of txs) {
      const qty = tx.quantityOz;
      const total = tx.totalUsd;
      if (!Number.isFinite(qty) || !Number.isFinite(total) || qty <= 0 || total < 0) continue;

      if (tx.direction === "buy") {
        quantityOz += qty;
        costBasisUsd += total;
      } else {
        const avgCost = quantityOz > 0 ? costBasisUsd / quantityOz : 0;
        const removableCost = avgCost * qty;
        quantityOz -= qty;
        costBasisUsd -= removableCost;
        realizedUsd += total - removableCost;
      }
    }

    // Normalize tiny float drift.
    quantityOz = round(quantityOz, 6);
    costBasisUsd = round(costBasisUsd, 2);
    realizedUsd = round(realizedUsd, 2);

    const avgCostUsdPerOz = quantityOz > 0 ? round(costBasisUsd / quantityOz, 4) : null;
    const priceUsdPerOz = pricesUsdPerOz[metalCode] ?? null;
    const marketValueUsd =
      priceUsdPerOz != null && quantityOz > 0 ? round(quantityOz * priceUsdPerOz, 2) : null;
    const unrealizedUsd =
      marketValueUsd != null && quantityOz > 0 ? round(marketValueUsd - costBasisUsd, 2) : null;

    metals.push({
      metalCode,
      quantityOz,
      costBasisUsd,
      realizedUsd,
      avgCostUsdPerOz,
      priceUsdPerOz: priceUsdPerOz != null ? round(priceUsdPerOz, 4) : null,
      marketValueUsd,
      unrealizedUsd,
    });
  }

  metals.sort((a, b) => a.metalCode.localeCompare(b.metalCode));

  const totalsCost = round(
    metals.reduce((sum, m) => sum + (m.costBasisUsd || 0), 0),
    2
  );
  const totalsRealized = round(
    metals.reduce((sum, m) => sum + (m.realizedUsd || 0), 0),
    2
  );

  const anyMarket = metals.some((m) => m.marketValueUsd != null);
  const totalsMarket = anyMarket
    ? round(
        metals.reduce((sum, m) => sum + (m.marketValueUsd || 0), 0),
        2
      )
    : null;
  const totalsUnrealized = totalsMarket != null ? round(totalsMarket - totalsCost, 2) : null;

  return {
    metals,
    totals: {
      costBasisUsd: totalsCost,
      realizedUsd: totalsRealized,
      marketValueUsd: totalsMarket,
      unrealizedUsd: totalsUnrealized,
    },
  };
}
