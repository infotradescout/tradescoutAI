// Track affiliate commissions and update balances
export const trackCommission = async (
  affiliateId: string,
  transactionId: string,
  amount: number,
  type: 'lead' | 'transaction'
) => {
  const commission = amount * 0.10; // 10% standard

  await db.insert(commissions).values({
    affiliateId,
    transactionId,
    amount: commission,
    status: 'pending',
    type
  });

  // Update affiliate balance
  await db.update(users)
    .set({
      affiliateBalance: sql`affiliate_balance + ${commission}`
    })
    .where(eq(users.id, affiliateId));

  return commission;
};