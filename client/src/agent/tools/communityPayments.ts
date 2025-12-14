export type CreateCommunityVaultDonationCheckoutArgs = {
  profileId: string;
  amount: number;
  causeId?: string;
  successUrl: string;
  cancelUrl: string;
};

export async function createCommunityVaultDonationCheckoutSession(
  args: CreateCommunityVaultDonationCheckoutArgs
): Promise<{ url: string; id: string }> {
  const res = await fetch('/api/community-vault/checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profileId: args.profileId,
      amount: args.amount,
      causeId: args.causeId,
      successUrl: args.successUrl,
      cancelUrl: args.cancelUrl,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || 'Failed to create community vault donation checkout');
  }

  return res.json();
}

export type CreatePlatformSupportCheckoutArgs = {
  amount: number;
  mode: 'one_time' | 'subscription';
  originatingProfileId?: string;
  successUrl: string;
  cancelUrl: string;
};

export async function createPlatformSupportCheckoutSession(
  args: CreatePlatformSupportCheckoutArgs
): Promise<{ url: string; id: string }> {
  const res = await fetch('/api/platform-support/checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: args.amount,
      mode: args.mode,
      originatingProfileId: args.originatingProfileId,
      successUrl: args.successUrl,
      cancelUrl: args.cancelUrl,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || 'Failed to create platform support checkout');
  }

  return res.json();
}
