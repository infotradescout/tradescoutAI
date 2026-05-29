export type ScoutCoinStatus = "disabled" | "testnet" | "mainnet";

export type ScoutCoinChain = "ethereum" | "polygon" | "base" | "solana" | "other";

export type ScoutCoinKycStatus = "unverified" | "pending" | "verified" | "rejected";

export type ScoutCoinTransactionType =
  | "buy"
  | "send"
  | "receive"
  | "redeem"
  | "refund"
  | "admin_freeze";

export type ScoutCoinRedeemTarget = "trade_scout_perk" | "meal_partner_perk";

export interface ScoutCoinTokenConfig {
  chain: ScoutCoinChain;
  contractAddress: string;
  symbol: string;
  decimals: number;
  status: ScoutCoinStatus;
}

export interface ScoutCoinWalletRegistryEntry {
  userId: string;
  walletAddress: string;
  custodialProviderId?: string | null;
  kycStatus: ScoutCoinKycStatus;
  frozen: boolean;
  jurisdiction?: string | null;
  updatedAt: string;
}

export interface ScoutCoinComplianceConfig {
  kycRequiredForBuy: boolean;
  kycRequiredForSend: boolean;
  blockedJurisdictions: string[];
  buyLimitPerTx: number;
  sendLimitPerTx: number;
}

export interface ScoutCoinPriceConfig {
  enabled: boolean;
  providerConfigured: boolean;
  sourceType: "none" | "mock" | "dex" | "oracle" | "onramp";
}

export interface ScoutCoinLedgerEntry {
  id: string;
  userId: string;
  txType: ScoutCoinTransactionType;
  amount: number;
  counterpartyUserId?: string | null;
  walletAddress?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ScoutCoinAuditEvent {
  id: string;
  eventType: string;
  userId?: string | null;
  actorId?: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}
