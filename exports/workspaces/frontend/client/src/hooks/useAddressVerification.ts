import { useQuery } from "@tanstack/react-query";

export function useAddressVerification() {
  const { data: status, isLoading } = useQuery({
    queryKey: ['/api/address-verification/status'],
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