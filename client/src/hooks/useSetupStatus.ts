import { useQuery } from '@tanstack/react-query';

interface SetupStatusResponse {
  needsSetup: boolean;
}

export function useSetupStatus() {
  const { data, isLoading } = useQuery<SetupStatusResponse>({
    queryKey: ['/api/auth/setup-status'],
    queryFn: async () => {
      const response = await fetch('/api/auth/setup-status', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error(`Setup status request failed: ${response.status}`);
      }
      return response.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    needsSetup: data?.needsSetup || false,
    isLoading
  };
}