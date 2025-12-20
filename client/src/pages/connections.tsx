import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ConnectionUser {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  city?: string | null;
  state?: string | null;
  roles?: string[] | null;
  role?: string | null;
  followedAt?: string | null;
}

function SuggestedConnections({ followers, following }: { followers: ConnectionUser[]; following: ConnectionUser[] }) {
  // Simple suggestion heuristic: followers you don't yet follow back.
  const followingIds = new Set((following || []).map((u) => u.id));
  const suggestions = (followers || []).filter((u) => !followingIds.has(u.id));

  if (!suggestions.length) {
    return (
      <p className="text-sm text-muted-foreground">
        You&rsquo;re caught up for now. As more people follow you, we&rsquo;ll suggest new connections here.
      </p>
    );
  }

  return <ConnectionList users={suggestions.slice(0, 10)} />;
}

function ConnectionList({ users }: { users: ConnectionUser[] }) {
  if (!users || users.length === 0) {
    return <p className="text-sm text-muted-foreground">No connections yet.</p>;
  }

  return (
    <div className="space-y-3">
      {users.map((u) => {
        const displayName = u.firstName || u.lastName ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : "TradeScout User";
        const location = [u.city, u.state].filter(Boolean).join(", ") || "Location not set";

        return (
          <div
            key={u.id}
            className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                {u.profileImageUrl ? (
                  <AvatarImage src={u.profileImageUrl} alt={displayName} />
                ) : (
                  <AvatarFallback>
                    {displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-none">{displayName}</span>
                <span className="text-xs text-muted-foreground">{location}</span>
              </div>
            </div>
            <a href={`/profile/${u.id}`}>
              <Button size="sm" variant="outline">
                View profile
              </Button>
            </a>
          </div>
        );
      })}
    </div>
  );
}

export default function ConnectionsPage() {
  const { data: summary } = useQuery({
    queryKey: ["/api/social/connections/summary"],
    queryFn: () => apiRequest("GET", "/api/social/connections/summary"),
  });

  const { data: following } = useQuery<ConnectionUser[]>({
    queryKey: ["/api/social/connections/following"],
    queryFn: () => apiRequest("GET", "/api/social/connections/following"),
  });

  const { data: followers } = useQuery<ConnectionUser[]>({
    queryKey: ["/api/social/connections/followers"],
    queryFn: () => apiRequest("GET", "/api/social/connections/followers"),
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Connections</h1>
            <p className="text-sm text-muted-foreground">
              People you follow and people who follow you across TradeScout.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Followers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {summary?.followers ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Following</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {summary?.following ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Mutual Connections</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {summary?.mutual ?? 0}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="following">
              <TabsList>
                <TabsTrigger value="following">Following</TabsTrigger>
                <TabsTrigger value="followers">Followers</TabsTrigger>
                <TabsTrigger value="suggested">Suggested</TabsTrigger>
              </TabsList>
              <TabsContent value="following" className="mt-4">
                <ConnectionList users={following || []} />
              </TabsContent>
              <TabsContent value="followers" className="mt-4">
                <ConnectionList users={followers || []} />
              </TabsContent>
              <TabsContent value="suggested" className="mt-4">
                <SuggestedConnections followers={followers || []} following={following || []} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
