import { useQuery } from '@tanstack/react-query';

interface SetupStatusResponse {
  needsSetup: boolean;
}

export function useSetupStatus() {
  const { data, isLoading } = useQuery<SetupStatusResponse>({
    queryKey: ['/api/auth/setup-status'],
    retry: false,
  });

  return {
    needsSetup: data?.needsSetup || false,
    isLoading
  };
}