import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

type NotificationsSummary = {
  unreadThreads: number;
  openHoaVotes: number;
};

export function useNotifications() {
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery<{ summary: NotificationsSummary }>({
    queryKey: ["/api/notifications/summary"],
    queryFn: async () => {
      return apiRequest("GET", "/api/notifications/summary");
    },
    // Only fetch notifications when a user is logged in
    enabled: !!user,
    // Don't retry on auth failures (e.g., 401s)
    retry: false,
    // Avoid refetch on window focus while logged out
    refetchOnWindowFocus: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const summary = data?.summary;

  const unreadCount =
    (summary?.unreadThreads ?? 0) + (summary?.openHoaVotes ?? 0);

  return {
    unreadCount,
    summary,
    isLoading,
    isError,
  };
}
