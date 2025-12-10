import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type NotificationsSummary = {
  unreadThreads: number;
  openHoaVotes: number;
};

export function useNotifications() {
  const { data, isLoading, isError } = useQuery<{ summary: NotificationsSummary }>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      return apiRequest("GET", "/api/notifications");
    },
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
