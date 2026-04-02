// Track affiliate commissions and update balances
export const trackCommission = async (
  affiliateId: string,
  transactionId: string,
  amount: number,
  type: 'lead' | 'transaction'
) => {
  // Stub implementation: record commission amount only.
  const commission = amount * 0.10; // 10% standard
  console.log('trackCommission stub invoked', { affiliateId, transactionId, amount, type });
  return commission;
};