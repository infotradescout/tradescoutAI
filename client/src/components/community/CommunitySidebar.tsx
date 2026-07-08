import { useQuery } from "@tanstack/react-query";
import { Home, Landmark, MapPin, Users2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocationContext } from "@/hooks/useLocationContext";

type CommunityGroup = {
  id: string;
  name?: string | null;
  title?: string | null;
  memberCount?: number | null;
  membersCount?: number | null;
  scope?: string | null;
};

type GroupsResponse = { groups?: CommunityGroup[] } | CommunityGroup[];

function getGroups(payload: GroupsResponse | undefined): CommunityGroup[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.groups)) return payload.groups;
  return [];
}

export function CommunitySidebar() {
  const location = useLocationContext();
  const stateCode = location.stateCode as string | undefined;
  const countyFips = location.countyFips as string | undefined;
  const localLabel = location.label || [location.countyName, stateCode].filter(Boolean).join(", ");

  const { data, isLoading } = useQuery<GroupsResponse>({
    queryKey: ["/api/community/groups", stateCode, countyFips],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "6", offset: "0" });
      if (stateCode) params.set("stateCode", stateCode);
      if (countyFips) params.set("countyFips", countyFips);
      const res = await fetch(`/api/community/groups?${params.toString()}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("Failed to load community groups");
      return res.json();
    },
  });

  const groups = getGroups(data);

  return (
    <aside className="space-y-4" data-testid="community-sidebar">
      <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-white">
            <Users2 className="h-4 w-4 text-ts-orange" />
            My Groups
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-xs text-white/60">Loading groups...</p>
          ) : groups.length === 0 ? (
            <p className="text-xs text-white/60">No local groups joined yet.</p>
          ) : (
            groups.map((group) => {
              const memberCount = group.memberCount ?? group.membersCount ?? 0;
              return (
                <div
                  key={group.id}
                  className="rounded-lg border border-white/10 bg-tsBg/40 px-3 py-2"
                >
                  <div className="truncate text-sm font-medium text-white">
                    {group.name || group.title || "Community group"}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-white/60">
                    <span>{memberCount.toLocaleString()} members</span>
                    {group.scope ? <Badge variant="outline">{group.scope}</Badge> : null}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-white">
            <Landmark className="h-4 w-4 text-ts-orange" />
            Local Area
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-white/65">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/50" />
            <span>{localLabel || "Choose a county to focus this feed."}</span>
          </div>
          {countyFips ? (
            <div className="text-[11px] text-white/45">County FIPS {countyFips}</div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border border-dashed border-white/15 bg-[color:var(--surface-card)]">
        <CardContent className="flex items-start gap-3 p-4">
          <Home className="mt-0.5 h-4 w-4 shrink-0 text-white/45" />
          <div>
            <div className="text-sm font-medium text-white">Posts related to your home</div>
            <p className="mt-1 text-xs text-white/55">Reserved for a later home-aware lane.</p>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}
