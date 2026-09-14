import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { JwStoneEmployeeToolsLoader } from "./JwStoneEmployeeToolsLoader";

type Access = { viewerId: string; allowed: boolean; enabled: boolean; canManageStaff?: boolean };

export function JwStoneEmployeeReceiving({ onEnter }: { onEnter?: () => void } = {}) {
  const { user } = useAuth();
  const viewerId = String(user?.id || "");
  const access = useQuery<Access>({
    queryKey: ["jw-stone", "receiving-access", viewerId],
    enabled: Boolean(viewerId),
    queryFn: () => apiRequest("GET", "/api/u/jw-stone/receiving/access"),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchInterval: 30000,
  });
  const denied =
    access.error instanceof ApiError &&
    (access.error.status === 401 || access.error.status === 403);
  if (!viewerId || denied || access.data?.viewerId !== viewerId || !access.data.allowed)
    return null;
  // Account changes unmount the old editor; local drafts are keyed by the authenticated user.
  return (
    <JwStoneEmployeeToolsLoader
      key={viewerId}
      viewerId={viewerId}
      onEnter={onEnter}
      enabled={access.data.enabled}
      canManageStaff={access.data.canManageStaff === true}
    />
  );
}
