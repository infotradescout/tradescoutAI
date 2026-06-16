import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, X, CheckCircle, Clock, Bookmark } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [, navigate] = useLocation();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications:list"],
    enabled: isAuthenticated,
    refetchInterval: 60000, // Check every minute
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to mark as read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications:list"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to mark all as read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications:list"] });
      toast({
        title: "Updates marked read",
        description: "You are caught up.",
      });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }

    // Keep destination handling unchanged while copy stays user-facing.
    if (notification.type === "saved_ad_reminder" && notification.relatedId) {
      navigate("/saved-ads");
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "saved_ad_reminder":
        return <Bookmark className="h-4 w-4 text-ts-orange" />;
      default:
        return <Bell className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0 hover:bg-tsCard">
          <Bell className="h-4 w-4 text-white/70" />
          {unreadCount > 0 && (
            <Badge
              variant="error"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs bg-ts-orange hover:bg-ts-orange border-none"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0 bg-tsCard border-white/10" align="end">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-white">Updates</CardTitle>
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1 text-xs text-white/60 hover:text-white"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Mark reviewed
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0 max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center">
              <div className="animate-spin w-5 h-5 border-2 border-ts-orange/30 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm text-white/60">Loading updates...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center">
              <Bell className="h-8 w-8 text-white/60 mx-auto mb-2" />
              <p className="text-sm text-white/60">No updates yet</p>
            </div>
          ) : (
            <div className="space-y-0">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 border-b border-white/10 cursor-pointer hover:bg-tsCard/50 transition-colors",
                    !notification.isRead && "bg-tsCard/30"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p
                          className={cn(
                            "text-sm font-medium truncate",
                            notification.isRead ? "text-white/70" : "text-white"
                          )}
                        >
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-ts-orange rounded-full flex-shrink-0 ml-2"></div>
                        )}
                      </div>
                      <p className="text-xs text-white/60 line-clamp-2 mb-1">
                        {notification.content}
                      </p>
                      <div className="flex items-center text-xs text-white/60">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatTimeAgo(notification.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </PopoverContent>
    </Popover>
  );
}
