import { randomUUID } from "crypto";
import type {
  ScoutCoinAuditEvent,
  ScoutCoinComplianceConfig,
  ScoutCoinKycStatus,
  ScoutCoinLedgerEntry,
  ScoutCoinPriceConfig,
  ScoutCoinRedeemTarget,
  ScoutCoinTokenConfig,
  ScoutCoinWalletRegistryEntry,
} from "../../shared/scoutcoin";

const ALLOW_MAINNET = process.env.SCOUTCOIN_ALLOW_MAINNET === "true";

const tokenConfig: ScoutCoinTokenConfig = {
  chain: "base",
  contractAddress: "",
  symbol: "SCOUT",
  decimals: 18,
  status: "disabled",
};

const priceConfig: ScoutCoinPriceConfig = {
  enabled: false,
  providerConfigured: false,
  sourceType: "none",
};

const complianceConfig: ScoutCoinComplianceConfig = {
  kycRequiredForBuy: true,
  kycRequiredForSend: true,
  blockedJurisdictions: [],
  buyLimitPerTx: 10000,
  sendLimitPerTx: 10000,
};

const walletRegistry = new Map<string, ScoutCoinWalletRegistryEntry>();
const ledger: ScoutCoinLedgerEntry[] = [];
const auditLog: ScoutCoinAuditEvent[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeAmount(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("amount must be a positive number");
  }
  return value;
}

function normalizeJurisdiction(input: unknown): string {
  return String(input || "")
    .trim()
    .toLowerCase();
}

function pushAudit(
  eventType: string,
  details: Record<string, unknown>,
  userId?: string | null,
  actorId?: string | null
) {
  auditLog.push({
    id: randomUUID(),
    eventType,
    userId: userId || null,
    actorId: actorId || null,
    details,
    createdAt: nowIso(),
  });
}

function ensureWallet(userId: string): ScoutCoinWalletRegistryEntry {
  const existing = walletRegistry.get(userId);
  if (existing) return existing;
  const created: ScoutCoinWalletRegistryEntry = {
    userId,
    walletAddress: "",
    custodialProviderId: null,
    kycStatus: "unverified",
    frozen: false,
    jurisdiction: null,
    updatedAt: nowIso(),
  };
  walletRegistry.set(userId, created);
  return created;
}

function requireMainnetDisabled() {
  if (tokenConfig.status === "mainnet" && !ALLOW_MAINNET) {
    throw new Error("mainnet is locked for this environment");
  }
}

function requireTokenActive() {
  if (tokenConfig.status === "disabled") {
    throw new Error("scoutcoin is disabled");
  }
  requireMainnetDisabled();
}

function isKycVerified(status: ScoutCoinKycStatus): boolean {
  return status === "verified";
}

function blockedByJurisdiction(jurisdiction?: string | null): boolean {
  const normalized = normalizeJurisdiction(jurisdiction);
  if (!normalized) return false;
  return complianceConfig.blockedJurisdictions
    .map((j) => normalizeJurisdiction(j))
    .includes(normalized);
}

function assertComplianceForBuy(wallet: ScoutCoinWalletRegistryEntry, amount: number) {
  if (wallet.frozen) throw new Error("wallet is frozen");
  if (blockedByJurisdiction(wallet.jurisdiction)) throw new Error("jurisdiction blocked");
  if (complianceConfig.kycRequiredForBuy && !isKycVerified(wallet.kycStatus)) {
    throw new Error("kyc required before buy");
  }
  if (amount > complianceConfig.buyLimitPerTx) {
    throw new Error("buy exceeds per-transaction limit");
  }
}

function assertComplianceForSend(wallet: ScoutCoinWalletRegistryEntry, amount: number) {
  if (wallet.frozen) throw new Error("wallet is frozen");
  if (blockedByJurisdiction(wallet.jurisdiction)) throw new Error("jurisdiction blocked");
  if (complianceConfig.kycRequiredForSend && !isKycVerified(wallet.kycStatus)) {
    throw new Error("kyc required before send");
  }
  if (amount > complianceConfig.sendLimitPerTx) {
    throw new Error("send exceeds per-transaction limit");
  }
}

function addLedgerEntry(
  entry: Omit<ScoutCoinLedgerEntry, "id" | "createdAt">
): ScoutCoinLedgerEntry {
  const created: ScoutCoinLedgerEntry = {
    ...entry,
    id: randomUUID(),
    createdAt: nowIso(),
  };
  ledger.push(created);
  pushAudit(
    "scoutcoin_ledger_movement",
    {
      txId: created.id,
      txType: created.txType,
      amount: created.amount,
      counterpartyUserId: created.counterpartyUserId || null,
    },
    created.userId,
    null
  );
  return created;
}

export const scoutcoinService = {
  getTokenConfig(): ScoutCoinTokenConfig {
    return { ...tokenConfig };
  },

  setTokenStatus(status: ScoutCoinTokenConfig["status"]) {
    tokenConfig.status = status;
    pushAudit("scoutcoin_token_status_updated", { status });
  },

  getPriceConfig(): ScoutCoinPriceConfig {
    return { ...priceConfig };
  },

  setPriceConfig(next: Partial<ScoutCoinPriceConfig>) {
    priceConfig.enabled = typeof next.enabled === "boolean" ? next.enabled : priceConfig.enabled;
    priceConfig.providerConfigured =
      typeof next.providerConfigured === "boolean"
        ? next.providerConfigured
        : priceConfig.providerConfigured;
    if (next.sourceType) priceConfig.sourceType = next.sourceType;
    pushAudit("scoutcoin_price_config_updated", { ...priceConfig });
  },

  getComplianceConfig(): ScoutCoinComplianceConfig {
    return {
      ...complianceConfig,
      blockedJurisdictions: [...complianceConfig.blockedJurisdictions],
    };
  },

  setComplianceConfig(next: Partial<ScoutCoinComplianceConfig>) {
    if (typeof next.kycRequiredForBuy === "boolean") {
      complianceConfig.kycRequiredForBuy = next.kycRequiredForBuy;
    }
    if (typeof next.kycRequiredForSend === "boolean") {
      complianceConfig.kycRequiredForSend = next.kycRequiredForSend;
    }
    if (Array.isArray(next.blockedJurisdictions)) {
      complianceConfig.blockedJurisdictions = [...next.blockedJurisdictions];
    }
    if (typeof next.buyLimitPerTx === "number" && Number.isFinite(next.buyLimitPerTx)) {
      complianceConfig.buyLimitPerTx = Math.max(0, next.buyLimitPerTx);
    }
    if (typeof next.sendLimitPerTx === "number" && Number.isFinite(next.sendLimitPerTx)) {
      complianceConfig.sendLimitPerTx = Math.max(0, next.sendLimitPerTx);
    }
    pushAudit("scoutcoin_compliance_config_updated", { ...complianceConfig });
  },

  getWalletRegistryEntry(userId: string): ScoutCoinWalletRegistryEntry {
    return { ...ensureWallet(userId) };
  },

  upsertWalletRegistryEntry(input: {
    userId: string;
    walletAddress?: string;
    custodialProviderId?: string | null;
    jurisdiction?: string | null;
  }): ScoutCoinWalletRegistryEntry {
    const wallet = ensureWallet(input.userId);
    if (typeof input.walletAddress === "string") wallet.walletAddress = input.walletAddress.trim();
    if (input.custodialProviderId !== undefined)
      wallet.custodialProviderId = input.custodialProviderId;
    if (input.jurisdiction !== undefined) wallet.jurisdiction = input.jurisdiction;
    wallet.updatedAt = nowIso();
    walletRegistry.set(wallet.userId, wallet);
    pushAudit(
      "scoutcoin_wallet_registry_updated",
      {
        userId: wallet.userId,
        walletAddress: wallet.walletAddress,
        custodialProviderId: wallet.custodialProviderId,
        jurisdiction: wallet.jurisdiction,
      },
      wallet.userId,
      null
    );
    return { ...wallet };
  },

  setKycStatus(
    userId: string,
    kycStatus: ScoutCoinKycStatus,
    actorId?: string
  ): ScoutCoinWalletRegistryEntry {
    const wallet = ensureWallet(userId);
    wallet.kycStatus = kycStatus;
    wallet.updatedAt = nowIso();
    walletRegistry.set(userId, wallet);
    pushAudit("scoutcoin_kyc_status_updated", { userId, kycStatus }, userId, actorId || null);
    return { ...wallet };
  },

  freezeWallet(
    userId: string,
    frozen: boolean,
    actorId?: string,
    reason?: string
  ): ScoutCoinWalletRegistryEntry {
    const wallet = ensureWallet(userId);
    wallet.frozen = frozen;
    wallet.updatedAt = nowIso();
    walletRegistry.set(userId, wallet);
    addLedgerEntry({
      userId,
      txType: "admin_freeze",
      amount: 0,
      metadata: { frozen, reason: reason || null, actorId: actorId || null },
    });
    pushAudit(
      "scoutcoin_wallet_freeze_updated",
      { userId, frozen, reason: reason || null },
      userId,
      actorId || null
    );
    return { ...wallet };
  },

  getUserBalance(userId: string): number {
    let balance = 0;
    for (const tx of ledger) {
      if (tx.userId !== userId) continue;
      if (tx.txType === "buy" || tx.txType === "receive" || tx.txType === "refund")
        balance += tx.amount;
      if (tx.txType === "send" || tx.txType === "redeem") balance -= tx.amount;
    }
    return Number(balance.toFixed(8));
  },

  getUserTransactions(userId: string, limit = 100): ScoutCoinLedgerEntry[] {
    return ledger
      .filter((tx) => tx.userId === userId)
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, Math.max(1, Math.min(500, limit)));
  },

  getAuditLog(limit = 200): ScoutCoinAuditEvent[] {
    return auditLog
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, Math.max(1, Math.min(1000, limit)));
  },

  getPriceQuote(): { enabled: boolean; sourceType: string; quote: number | null } {
    if (!priceConfig.enabled || !priceConfig.providerConfigured) {
      return { enabled: false, sourceType: priceConfig.sourceType, quote: null };
    }
    if (process.env.NODE_ENV !== "production" && priceConfig.sourceType === "mock") {
      return { enabled: true, sourceType: "mock", quote: 1 };
    }
    return { enabled: true, sourceType: priceConfig.sourceType, quote: null };
  },

  buy(userId: string, amountRaw: unknown): ScoutCoinLedgerEntry {
    requireTokenActive();
    if (!priceConfig.providerConfigured) throw new Error("buy provider not configured");
    const amount = normalizeAmount(amountRaw);
    const wallet = ensureWallet(userId);
    assertComplianceForBuy(wallet, amount);
    return addLedgerEntry({ userId, txType: "buy", amount });
  },

  send(
    fromUserId: string,
    toUserId: string,
    amountRaw: unknown
  ): { sender: ScoutCoinLedgerEntry; receiver: ScoutCoinLedgerEntry } {
    requireTokenActive();
    const amount = normalizeAmount(amountRaw);
    if (!toUserId || toUserId.trim() === "" || toUserId === fromUserId) {
      throw new Error("invalid recipient");
    }
    const senderWallet = ensureWallet(fromUserId);
    const receiverWallet = ensureWallet(toUserId);
    if (receiverWallet.frozen) throw new Error("recipient wallet is frozen");
    assertComplianceForSend(senderWallet, amount);
    const balance = this.getUserBalance(fromUserId);
    if (balance < amount) throw new Error("insufficient balance");

    const sender = addLedgerEntry({
      userId: fromUserId,
      txType: "send",
      amount,
      counterpartyUserId: toUserId,
    });
    const receiver = addLedgerEntry({
      userId: toUserId,
      txType: "receive",
      amount,
      counterpartyUserId: fromUserId,
    });
    return { sender, receiver };
  },

  redeem(userId: string, amountRaw: unknown, target: ScoutCoinRedeemTarget): ScoutCoinLedgerEntry {
    requireTokenActive();
    const amount = normalizeAmount(amountRaw);
    const wallet = ensureWallet(userId);
    if (wallet.frozen) throw new Error("wallet is frozen");
    const balance = this.getUserBalance(userId);
    if (balance < amount) throw new Error("insufficient balance");
    if (target !== "trade_scout_perk" && target !== "meal_partner_perk") {
      throw new Error("invalid redeem target");
    }
    return addLedgerEntry({
      userId,
      txType: "redeem",
      amount,
      metadata: { target },
    });
  },

  refund(userId: string, amountRaw: unknown, reason?: string): ScoutCoinLedgerEntry {
    const amount = normalizeAmount(amountRaw);
    return addLedgerEntry({
      userId,
      txType: "refund",
      amount,
      metadata: { reason: reason || null },
    });
  },

  resetForTests() {
    tokenConfig.chain = "base";
    tokenConfig.contractAddress = "";
    tokenConfig.symbol = "SCOUT";
    tokenConfig.decimals = 18;
    tokenConfig.status = "disabled";
    priceConfig.enabled = false;
    priceConfig.providerConfigured = false;
    priceConfig.sourceType = "none";
    complianceConfig.kycRequiredForBuy = true;
    complianceConfig.kycRequiredForSend = true;
    complianceConfig.blockedJurisdictions = [];
    complianceConfig.buyLimitPerTx = 10000;
    complianceConfig.sendLimitPerTx = 10000;
    walletRegistry.clear();
    ledger.length = 0;
    auditLog.length = 0;
  },
};
