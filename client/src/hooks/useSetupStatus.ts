import { useQuery } from '@tanstack/react-query';

export function useSetupStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/auth/setup-status'],
    retry: false,
  });

  return {
    needsSetup: data?.needsSetup || false,
    isLoading
  };
}