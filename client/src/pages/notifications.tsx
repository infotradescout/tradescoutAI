import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Filter
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

export default function Notifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Fetch user notifications
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["/api/notifications", filter === 'unread'],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/notifications?unreadOnly=${filter === 'unread'}`);
      return response.json();
    }
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiRequest("PUT", `/api/notifications/${notificationId}/read`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/notifications/mark-all-read");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "All Notifications Marked as Read",
        description: "Your notification list has been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case 'transaction':
        return <ShoppingBag className="h-5 w-5 text-green-500" />;
      case 'review':
        return <Star className="h-5 w-5 text-yellow-500" />;
      case 'listing':
        return <TrendingUp className="h-5 w-5 text-purple-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case 'message':
        return 'Message';
      case 'transaction':
        return 'Transaction';
      case 'review':
        return 'Review';
      case 'listing':
        return 'Listing';
      default:
        return 'Notification';
    }
  };

  const unreadCount = notifications?.filter((n: any) => !n.isRead).length || 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Notifications</h1>
            <p className="text-muted-foreground">
              Stay updated on your marketplace activity and conversations
            </p>
          </div>
          
          <div className="flex items-center gap-2">
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
        </div>

        <div className="space-y-6">
          {/* Notification Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unreadCount} new
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={filter} onValueChange={(value) => setFilter(value as 'all' | 'unread')}>
                <TabsList>
                  <TabsTrigger value="all">All Notifications</TabsTrigger>
                  <TabsTrigger value="unread">
                    Unread Only
                    {unreadCount > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {unreadCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>

          {/* Notifications List */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Your latest notifications and updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 border rounded-lg animate-pulse">
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
                        className={`flex items-start gap-4 p-4 rounded-lg transition-colors ${
                          !notification.isRead ? 'bg-blue-50 dark:bg-blue-950/20 border-l-4 border-l-blue-500' : 'hover:bg-muted/50'
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
                                  <Badge variant="destructive" className="text-xs">
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
                              
                              <h3 className="font-medium mb-1">
                                {notification.title}
                              </h3>
                              
                              <p className="text-muted-foreground text-sm mb-2">
                                {notification.message}
                              </p>
                              
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
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
                  <h3 className="text-lg font-semibold mb-2">No Notifications</h3>
                  <p className="text-muted-foreground mb-4">
                    {filter === 'unread' 
                      ? "You're all caught up! No unread notifications."
                      : "You'll see your notifications here when you have activity."
                    }
                  </p>
                  <Link href="/marketplace">
                    <Button>Browse Marketplace</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Manage how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Email Notifications</h4>
                    <p className="text-sm text-muted-foreground">
                      Receive important updates via email
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Configure
                  </Button>
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Saved Search Alerts</h4>
                    <p className="text-sm text-muted-foreground">
                      Get notified when new items match your saved searches
                    </p>
                  </div>
                  <Link href="/search">
                    <Button variant="outline" size="sm">
                      Manage Searches
                    </Button>
                  </Link>
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Transaction Updates</h4>
                    <p className="text-sm text-muted-foreground">
                      Stay informed about your marketplace transactions
                    </p>
                  </div>
                  <Badge variant="secondary">Always On</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}