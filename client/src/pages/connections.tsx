import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";

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

interface ContactConnection {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  city?: string | null;
  state?: string | null;
  roles?: string[] | null;
  role?: string | null;
  connectedAt?: string | null;
  intent?: string | null;
  authorityGate?: string | null;
  decisionScope?: string | null;
  countyFips?: string | null;
  threadId?: string | null;
}

interface IncomingContactRequest {
  id: string;
  createdAt?: string | null;
  fromUserId?: string | null;
  fromName?: string | null;
  fromRole?: string | null;
  fromVerified?: boolean | null;
  preview?: string | null;
  intent?: string | null;
  contactType?: string | null;
  postId?: string | null;
}

function SuggestedConnections({
  followers,
  following,
}: {
  followers: ConnectionUser[];
  following: ConnectionUser[];
}) {
  // Simple suggestion heuristic: followers you don't yet follow back.
  const followingIds = new Set((following || []).map((u) => u.id));
  const suggestions = (followers || []).filter((u) => !followingIds.has(u.id));

  if (!suggestions.length) {
    return (
      <p className="text-sm text-muted-foreground">
        You&rsquo;re caught up for now. As more people follow you, we&rsquo;ll suggest new
        connections here.
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
        const displayName =
          u.firstName || u.lastName
            ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
            : "TradeScout User";
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
                  <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                )}
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-none">{displayName}</span>
                <span className="text-xs text-muted-foreground">{location}</span>
              </div>
            </div>
            <Link href={`/profile/${u.id}`}>
              <Button size="sm" variant="outline">
                View profile
              </Button>
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function ContactConnectionsList({ connections }: { connections: ContactConnection[] }) {
  if (!connections || connections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No connections yet. Connections appear after you and another member approve first-contact.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {connections.map((c) => {
        const displayName =
          c.firstName || c.lastName
            ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()
            : "TradeScout User";
        const location = [c.city, c.state].filter(Boolean).join(", ") || "Location not set";
        const connectedAtLabel = c.connectedAt
          ? new Date(c.connectedAt).toLocaleDateString()
          : null;

        return (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                {c.profileImageUrl ? (
                  <AvatarImage src={c.profileImageUrl} alt={displayName} />
                ) : (
                  <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                )}
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-none">{displayName}</span>
                <span className="text-xs text-muted-foreground">
                  {location}
                  {connectedAtLabel ? ` \u2022 Connected ${connectedAtLabel}` : ""}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {c.threadId ? (
                <Link href={`/messages?thread=${encodeURIComponent(String(c.threadId))}`}>
                  <Button size="sm">Message</Button>
                </Link>
              ) : null}
              <Link href={`/profile/${c.id}`}>
                <Button size="sm" variant="outline">
                  View profile
                </Button>
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ConnectionsPage() {
  const [route, setRoute] = useLocation();
  const activeTab = useMemo(() => {
    const idx = route.indexOf("?");
    const search = idx >= 0 ? route.slice(idx + 1) : "";
    const tab = new URLSearchParams(search).get("tab");
    return tab === "social" ? "social" : "contact";
  }, [route]);

  const {
    data: contactConnections,
    isLoading: isLoadingContact,
    error: contactError,
  } = useQuery<ContactConnection[]>({
    queryKey: ["/api/social/contact-connections"],
    queryFn: () => apiRequest("GET", "/api/social/contact-connections"),
    enabled: activeTab === "contact",
  });

  const incomingRequestsQuery = useQuery<{ requests: IncomingContactRequest[] }>({
    queryKey: ["/api/social/conversations/requests/incoming"],
    queryFn: () => apiRequest("GET", "/api/social/conversations/requests/incoming"),
    enabled: activeTab === "contact",
  });
  const incomingRequests = incomingRequestsQuery.data?.requests || [];

  const { data: summary } = useQuery({
    queryKey: ["/api/social/connections/summary"],
    queryFn: () => apiRequest("GET", "/api/social/connections/summary"),
    enabled: activeTab === "social",
  });

  const { data: following } = useQuery<ConnectionUser[]>({
    queryKey: ["/api/social/connections/following"],
    queryFn: () => apiRequest("GET", "/api/social/connections/following"),
    enabled: activeTab === "social",
  });

  const { data: followers } = useQuery<ConnectionUser[]>({
    queryKey: ["/api/social/connections/followers"],
    queryFn: () => apiRequest("GET", "/api/social/connections/followers"),
    enabled: activeTab === "social",
  });

  return (
    <div className="bg-background py-8">
      <div className="container mx-auto space-y-6">
        <div className="flex items-center gap-3 connections-header">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Connections</h1>
            <p className="text-sm text-muted-foreground">
              People you&rsquo;ve approved contact with, plus your social follows.
            </p>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(next) =>
            setRoute(next === "social" ? "/connections?tab=social" : "/connections")
          }
        >
          <TabsList>
            <TabsTrigger value="contact" className="connections-contact-tab">
              Connections
            </TabsTrigger>
            <TabsTrigger value="social" className="connections-social-tab">
              Social
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contact" className="mt-6 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-medium">
                    Pending contact requests
                    {incomingRequests.length ? ` (${incomingRequests.length})` : ""}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Accepting opens contact and creates a connection.
                  </p>
                </div>
                <Link href="/messages?tab=requests">
                  <Button size="sm" variant="outline">
                    Review in Messages
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {incomingRequestsQuery.isError ? (
                  <p className="text-sm text-destructive">Failed to load requests.</p>
                ) : incomingRequestsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading requestsâ€¦</p>
                ) : incomingRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending requests right now.</p>
                ) : (
                  <div className="space-y-2">
                    {incomingRequests.slice(0, 6).map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {req.fromName || "TradeScout member"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {req.preview || "Wants to connect."}
                          </div>
                        </div>
                        <Link href="/messages?tab=requests">
                          <Button size="sm" variant="outline">
                            Open
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Approved contact connections</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 connections-contact-list">
                {contactError ? (
                  <p className="text-sm text-destructive">
                    {contactError instanceof Error
                      ? contactError.message
                      : "Failed to load connections."}
                  </p>
                ) : isLoadingContact ? (
                  <p className="text-sm text-muted-foreground">Loading connections…</p>
                ) : (
                  <ContactConnectionsList connections={contactConnections || []} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="social" className="mt-6 space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Followers</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{summary?.followers ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Following</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{summary?.following ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Mutual Connections</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{summary?.mutual ?? 0}</p>
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
                  <TabsContent value="suggested" className="mt-4 connections-suggested">
                    <SuggestedConnections followers={followers || []} following={following || []} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
