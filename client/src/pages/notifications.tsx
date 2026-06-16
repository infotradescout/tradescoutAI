import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Bell,
  MessageSquare,
  ShoppingBag,
  Star,
  TrendingUp,
  Check,
  CheckCheck,
  Mail,
  ExternalLink,
  Clock,
  Filter,
  Briefcase,
  Gift,
  Sparkles,
  Award,
  Users,
  Inbox,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { Page, Section } from "@/components/layout/PagePrimitives";

type IncomingRequest = {
  id: string;
  createdAt: string;
  fromUserId: string;
  fromName: string;
  fromRole?: string | null;
  fromVerified?: boolean;
  preview?: string;
  intent: "hire" | "advise" | "collaborate" | "reconnect";
  contactType?: "message" | "comment";
  postId?: string | null;
};

export default function Notifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["/api/notifications:list", filter === "unread"],
    queryFn: async () => {
      const unreadOnly = filter === "unread" ? "true" : "false";
      return apiRequest("GET", `/api/notifications?unread_only=${unreadOnly}`);
    },
  });

  const incomingRequestsQuery = useQuery<{ requests: IncomingRequest[] }>({
    queryKey: ["/api/social/conversations/requests/incoming"],
    queryFn: () => apiRequest("GET", "/api/social/conversations/requests/incoming"),
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("POST", `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications:list"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/notifications/mark-all-read");
    },
    onSuccess: () => {
      toast({
        title: "All notifications marked as read",
        description: "Your notification list has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications:list"] });
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "message":
        return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case "transaction":
        return <ShoppingBag className="h-5 w-5 text-green-500" />;
      case "review":
        return <Star className="h-5 w-5 text-yellow-500" />;
      case "listing":
        return <TrendingUp className="h-5 w-5 text-purple-500" />;
      case "new_project_request":
        return <Briefcase className="h-5 w-5 text-ts-orange" />;
      case "payment_received":
        return <ShoppingBag className="h-5 w-5 text-green-500" />;
      case "review_received":
        return <Star className="h-5 w-5 text-yellow-500" />;
      case "birthday":
      case "anniversary":
        return <Gift className="h-5 w-5 text-pink-500" />;
      case "promotional":
        return <TrendingUp className="h-5 w-5 text-purple-500" />;
      case "welcome":
        return <Sparkles className="h-5 w-5 text-blue-500" />;
      case "milestone":
        return <Award className="h-5 w-5 text-amber-500" />;
      case "social_follow":
        return <Users className="h-5 w-5 text-indigo-500" />;
      case "system_update":
        return <Bell className="h-5 w-5 text-white/60" />;
      default:
        return <Bell className="h-5 w-5 text-white/60" />;
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case "message":
        return "Message";
      case "transaction":
        return "Transaction";
      case "review":
        return "Review";
      case "listing":
        return "Listing";
      case "new_project_request":
        return "Direct Connect request";
      case "payment_received":
        return "Payment";
      case "review_received":
        return "Review";
      case "birthday":
        return "Birthday";
      case "anniversary":
        return "Anniversary";
      case "promotional":
        return "Exchange";
      case "welcome":
        return "Welcome";
      case "milestone":
        return "Milestone";
      case "social_follow":
        return "Follower";
      case "system_update":
        return "System";
      default:
        return "Notification";
    }
  };

  const unreadCount = notifications?.filter((n: any) => !n.isRead).length || 0;
  const incomingRequests = incomingRequestsQuery.data?.requests || [];

  return (
    <Page className="max-w-6xl">
      <Section
        title="Notifications"
        subtitle="Review messages, contact requests, and updates that need attention."
        actions={
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-xs">
              {notifications?.length || 0} total
            </Badge>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Mark All Read
              </Button>
            )}
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          {/* Filters sidebar */}
          <Card className="h-fit border-muted/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
              <CardDescription>Focus on what matters right now.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={filter} onValueChange={(value) => setFilter(value as "all" | "unread")}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="all" data-testid="notifications-filter-all">
                    All
                  </TabsTrigger>
                  <TabsTrigger value="unread" data-testid="notifications-filter-unread">
                    Unread
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="rounded-lg border border-muted/50 bg-muted/20 p-3 text-xs text-muted-foreground">
                Unread items stay here until you review or mark them read.
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Unread</span>
                  <Badge variant="secondary">{unreadCount}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Contact requests</span>
                  <Badge variant="secondary">{incomingRequests.length}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main content */}
          <div className="space-y-4">
            <Card className="border-muted/40">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Contact Requests</CardTitle>
                  <CardDescription>
                    First-time contacts require your approval before conversation opens.
                  </CardDescription>
                </div>
                <Link href="/messages?tab=requests">
                  <Button size="sm" variant="outline">
                    Review requests
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {incomingRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Inbox className="h-10 w-10 mx-auto mb-3 opacity-60" />
                    No contact requests waiting right now.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {incomingRequests.slice(0, 3).map((request) => (
                      <div
                        key={request.id}
                        className="rounded-xl border border-muted/40 bg-muted/20 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{request.fromName}</p>
                              <Badge
                                className={
                                  request.fromVerified
                                    ? "bg-green-500/20 text-green-600 text-[10px]"
                                    : "bg-white/10 text-white/70 text-[10px]"
                                }
                              >
                                {request.fromVerified ? "Verified" : "Unverified"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {request.contactType === "comment"
                                ? "Comment request"
                                : "Message request"}{" "}
                              - {request.intent}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        {request.preview && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {request.preview}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-muted/40">
              <CardHeader>
                <CardTitle>Recent updates</CardTitle>
                <CardDescription>Your latest TradeScout updates.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-4 p-4 border rounded-lg animate-pulse"
                      >
                        <div className="w-10 h-10 bg-muted rounded-full" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-3/4" />
                          <div className="h-3 bg-muted rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : notifications && notifications.length > 0 ? (
                  <div className="space-y-4">
                    {notifications.map((notification: any, index: number) => (
                      <div key={notification.id}>
                        <div
                          className={`flex items-start gap-4 p-4 rounded-xl transition-colors ${
                            !notification.isRead
                              ? "bg-blue-50 dark:bg-blue-950/20 border border-blue-500/30"
                              : "border border-transparent hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex-shrink-0 mt-1">
                            {getNotificationIcon(notification.type)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">
                                    {getNotificationTypeLabel(notification.type)}
                                  </Badge>
                                  {!notification.isRead && (
                                    <Badge variant="secondary" className="text-xs">
                                      New
                                    </Badge>
                                  )}
                                  {notification.sentViaEmail && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Mail className="h-3 w-3 mr-1" />
                                      Email Sent
                                    </Badge>
                                  )}
                                </div>

                                <h3 className="font-medium mb-1">{notification.title}</h3>

                                <p className="text-muted-foreground text-sm mb-2">
                                  {notification.message}
                                </p>

                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDistanceToNow(new Date(notification.createdAt), {
                                      addSuffix: true,
                                    })}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {notification.actionUrl && (
                                  <Link href={notification.actionUrl}>
                                    <Button size="sm" variant="outline">
                                      <ExternalLink className="h-4 w-4 mr-1" />
                                      View
                                    </Button>
                                  </Link>
                                )}

                                {!notification.isRead && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => markAsReadMutation.mutate(notification.id)}
                                    disabled={markAsReadMutation.isPending}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {index < notifications.length - 1 && <Separator className="my-2" />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No notifications</h3>
                    <p className="text-muted-foreground mb-4">
                      {filter === "unread"
                        ? "You're all caught up! No unread notifications."
                        : "You'll see your notifications here when you have activity."}
                    </p>
                    <Link href="/exchange">
                      <Button>Browse Exchange</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </Section>
    </Page>
  );
}
