import fetch from 'node-fetch';

interface WalletTaxStatementPayload {
  userId: string;
  period: {
    type: 'year' | 'quarter';
    year: number;
    quarter?: number;
    startDate: string;
    endDate: string;
  };
  totals: {
    totalCredits: number;
    totalDebits: number;
    netChange: number;
  };
  totalsByType: Array<{
    transactionType: string;
    totalCredits: number;
    totalDebits: number;
    netChange: number;
  }>;
}

export async function sendWalletTaxStatementToDealRoom(payload: WalletTaxStatementPayload) {
  const url = process.env.DEALROOM_ACCOUNTING_WEBHOOK_URL;
  if (!url) {
    console.warn('[DealRoom] DEALROOM_ACCOUNTING_WEBHOOK_URL not set; skipping export');
    return { delivered: false, reason: 'WEBHOOK_URL_NOT_CONFIGURED' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'wallet_tax_statement',
      statement: payload,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[DealRoom] Failed to send wallet tax statement', res.status, text);
    throw new Error(`Failed to send wallet tax statement to Deal Room (status ${res.status})`);
  }

  return { delivered: true };
}
