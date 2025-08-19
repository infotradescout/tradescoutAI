import { useQuery } from "@tanstack/react-query";

export function useAddressVerification() {
  const { data: status, isLoading } = useQuery({
    queryKey: ['/api/address-verification/status'],
    queryFn: async () => {
      const response = await fetch('/api/address-verification/status', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error(`Address verification status request failed: ${response.status}`);
      }
      return response.json();
    },
    retry: false,
  });

  const isVerified = (status as any)?.isVerified || false;
  const requiresVerification = (status as any)?.requiresVerification || false;
  const daysRemaining = (status as any)?.daysRemaining || 0;
  const isExpired = (status as any)?.isExpired || false;
  const deadline = (status as any)?.deadline ? new Date((status as any).deadline) : null;

  return {
    status,
    isLoading,
    isVerified,
    requiresVerification,
    daysRemaining,
    isExpired,
    deadline,
    hasGracePeriod: daysRemaining > 0 && !isVerified,
    needsUrgentAction: daysRemaining <= 3 && !isVerified,
  };
}