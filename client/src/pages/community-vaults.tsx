import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Lock, MapPin, DollarSign, BarChart3, AlertCircle } from "lucide-react";

interface Vault {
  id: string;
  profileId: string;
  currentBalance: string | number;
  lifetimeInflow: string | number;
  lifetimeOutflow: string | number;
  lastContributionAt?: string;
  metadata?: any;
}

interface LedgerEntry {
  id: string;
  vaultId: string;
  sourceType: string;
  sourceId?: string;
  amount: string | number;
  memo?: string;
  createdAt: string;
}

export default function CommunityVaultsPage() {
  const [selectedVault, setSelectedVault] = useState<string | null>(null);

  // Fetch all vaults statistics
  const { data: stats } = useQuery({
    queryKey: ["community-vaults-statistics"],
    queryFn: async () => {
      const res = await fetch("/api/community-vaults/statistics");
      if (!res.ok) throw new Error("Failed to fetch statistics");
      return res.json();
    },
  });

  // Fetch all vaults
  const { data: vaults = [] } = useQuery({
    queryKey: ["community-vaults"],
    queryFn: async () => {
      const res = await fetch("/api/community-vaults/vaults");
      if (!res.ok) throw new Error("Failed to fetch vaults");
      return res.json();
    },
  });

  // Fetch ledger for selected vault
  const { data: ledger = [] } = useQuery({
    queryKey: ["community-vault-ledger", selectedVault],
    queryFn: async () => {
      if (!selectedVault) return [];
      const res = await fetch(`/api/community-vaults/vaults/${selectedVault}/ledger`);
      if (!res.ok) throw new Error("Failed to fetch ledger");
      return res.json();
    },
    enabled: !!selectedVault,
  });

  const formatCurrency = (value: string | number) => {
    const num = parseFloat(value?.toString() || "0");
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const formatSourceType = (type: string) => {
    const mapping: { [key: string]: string } = {
      platform_support_share: "Platform Support",
      direct_donation: "Direct Donation",
      manual_adjustment: "Admin Adjustment",
      other: "Other",
    };
    return mapping[type] || type;
  };

  const selectedVaultData = selectedVault
    ? vaults.find((v: Vault) => v.id === selectedVault)
    : null;

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 flex items-center space-x-3">
            <Lock className="w-10 h-10" />
            <span>Community Vaults</span>
          </h1>
          <p className="text-lg text-white/70">
            Transparent fund management for local communities
          </p>
        </div>
      </div>

      {/* Key Statistics */}
      {stats && (
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 p-8">
            <div className="space-y-1">
              <p className="text-sm text-white/60 flex items-center space-x-1">
                <DollarSign className="w-4 h-4" />
                <span>Total Balance</span>
              </p>
              <p className="text-3xl font-bold text-white">
                {formatCurrency(stats.totalBalance)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-white/60 flex items-center space-x-1">
                <BarChart3 className="w-4 h-4" />
                <span>Active Vaults</span>
              </p>
              <p className="text-3xl font-bold text-white">{stats.totalVaults}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-white/60 flex items-center space-x-1">
                <TrendingUp className="w-4 h-4" />
                <span>Average Balance</span>
              </p>
              <p className="text-3xl font-bold text-white">{formatCurrency(stats.avgBalance)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-white/60">Top Vault</p>
              <p className="text-3xl font-bold text-white">
                {stats.topVaults && stats.topVaults.length > 0
                  ? formatCurrency(stats.topVaults[0].currentBalance)
                  : "$0"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto py-12 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Vault List */}
          <div className="lg:col-span-2">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white">All Vaults</h2>
              <p className="text-white/60 mt-1">Community funds managed transparently</p>
            </div>

            {vaults.length === 0 ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
                <AlertCircle className="w-8 h-8 text-blue-500 mx-auto mb-3" />
                <p className="text-white/70 font-medium">No community vaults yet</p>
                <p className="text-white/60 text-sm mt-1">
                  Community vaults will be created as profiles join
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {vaults.map((vault: Vault) => (
                  <div
                    key={vault.id}
                    onClick={() => setSelectedVault(vault.id)}
                    className={`cursor-pointer p-6 rounded-lg border-2 transition ${
                      selectedVault === vault.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-white/10 bg-white hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="bg-blue-100 p-3 rounded-lg">
                          <Lock className="text-blue-600 w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-white">
                            Vault {vault.id.slice(0, 8)}
                          </p>
                          <p className="text-sm text-white/60">Community Fund</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-white">
                          {formatCurrency(vault.currentBalance)}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/60">Lifetime Inflow</span>
                        <span className="font-semibold">
                          {formatCurrency(vault.lifetimeInflow)}
                        </span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5">
                        <div
                          className="bg-green-500 h-1.5 rounded-full"
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center justify-between text-sm text-white/60">
                      <span>Total Outflow: {formatCurrency(vault.lifetimeOutflow)}</span>
                      {vault.lastContributionAt && (
                        <span>Last: {new Date(vault.lastContributionAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vault Details */}
          {selectedVaultData && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-lg p-6 sticky top-4">
                <h3 className="text-xl font-bold text-white mb-4">Vault Details</h3>

                {/* Balance Cards */}
                <div className="space-y-3 mb-6">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                      Current Balance
                    </p>
                    <p className="text-2xl font-bold text-green-900 mt-1">
                      {formatCurrency(selectedVaultData.currentBalance)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                        Inflow
                      </p>
                      <p className="text-lg font-bold text-blue-900 mt-1">
                        {formatCurrency(selectedVaultData.lifetimeInflow)}
                      </p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                        Outflow
                      </p>
                      <p className="text-lg font-bold text-red-900 mt-1">
                        {formatCurrency(selectedVaultData.lifetimeOutflow)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Ledger */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-white mb-3">Recent Transactions</h4>
                  {ledger.length === 0 ? (
                    <p className="text-sm text-white/60 text-center py-4">No transactions yet</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {ledger.map((entry: LedgerEntry) => {
                        const amount = parseFloat(entry.amount?.toString() || "0");
                        const isPositive = amount >= 0;
                        return (
                          <div
                            key={entry.id}
                            className="flex items-start justify-between text-sm border-b pb-2"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-white">
                                {formatSourceType(entry.sourceType)}
                              </p>
                              <p className="text-xs text-white/60">
                                {new Date(entry.createdAt).toLocaleDateString()}
                              </p>
                              {entry.memo && (
                                <p className="text-xs text-white/60 mt-1">{entry.memo}</p>
                              )}
                            </div>
                            <p
                              className={`font-semibold ${isPositive ? "text-green-600" : "text-red-600"}`}
                            >
                              {isPositive ? "+" : ""}
                              {formatCurrency(amount)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
