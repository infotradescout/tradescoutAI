import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell,
  Check,
  CheckCheck,
  Archive,
  Settings,
  Gift,
  Award,
  MessageCircle,
  FileText,
  AlertCircle,
  Star,
  Calendar,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  priority: "low" | "normal" | "high" | "urgent" | "critical";
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
  iconName?: string;
  iconColor?: string;
  imageUrl?: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  isArchived: boolean;
  createdAt: string;
  readAt?: string;
}

// Icon mapping for notification types
const iconMap: Record<string, LucideIcon> = {
  gift: Gift,
  award: Award,
  bell: Bell,
  message: MessageCircle,
  file: FileText,
  alert: AlertCircle,
  star: Star,
  calendar: Calendar,
  sparkles: Sparkles,
};

// Color mapping for notification priorities and icons
const priorityColors = {
  low: "text-white/60",
  normal: "text-blue-500",
  high: "text-ts-orange",
  urgent: "text-red-500",
  critical: "text-red-600",
};

const iconColors = {
  blue: "text-blue-500",
  green: "text-green-500",
  yellow: "text-yellow-500",
  orange: "text-ts-orange",
  red: "text-red-500",
  purple: "text-purple-500",
  pink: "text-pink-500",
  gold: "text-yellow-600",
  gray: "text-white/60",
};

export function NotificationCenter() {
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const { data: incomingRequests = { requests: [] } } = useQuery<{ requests: any[] }>({
    queryKey: ["/api/social/conversations/requests/incoming"],
    queryFn: () => apiRequest("/api/social/conversations/requests/incoming"),
    enabled: isAuthenticated && isOpen,
  });
  const contactRequestCount = incomingRequests?.requests?.length || 0;

  // Fetch unread count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: async () => {
      try {
        return await apiRequest("/api/notifications/unread-count");
      } catch {
        return { count: 0 };
      }
    },
    enabled: isAuthenticated,
    refetchInterval: 30000, // Poll every 30 seconds
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: () => apiRequest("/api/notifications?limit=20"),
    enabled: isAuthenticated && isOpen,
    retry: false,
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest("/api/notifications/mark-all-read", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/notifications/${id}/archive`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const unreadCount = unreadData?.count || 0;

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }

    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  const handleMarkAsRead = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    markAsReadMutation.mutate(id);
  };

  const handleArchive = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    archiveMutation.mutate(id);
  };

  const getNotificationIcon = (notification: Notification) => {
    const IconComponent = iconMap[notification.iconName || "bell"] || Bell;
    const colorClass =
      iconColors[notification.iconColor as keyof typeof iconColors] || "text-blue-500";

    return <IconComponent className={cn("h-4 w-4", colorClass)} />;
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="error"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-96 max-h-[600px] p-0 bg-tsCard/95 backdrop-blur-sm border-white/10"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <DropdownMenuLabel className="text-white font-semibold">
            Notifications
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </DropdownMenuLabel>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
                className="text-ts-orange hover:text-ts-orange hover:bg-tsCard"
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/60 hover:text-white hover:bg-tsCard"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {contactRequestCount > 0 && (
          <div className="p-4 border-b border-white/10 bg-tsCard/40">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-amber-300">
                  Contact Requests
                </div>
                <p className="text-xs text-white/70 mt-1">
                  {contactRequestCount} waiting for approval
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-400 text-amber-300 hover:bg-amber-400/10"
                onClick={() => {
                  navigate("/messages?tab=requests");
                }}
              >
                Review
              </Button>
            </div>
          </div>
        )}

        <ScrollArea className="max-h-[500px]">
          {isLoading ? (
            <div className="p-4 text-center text-white/60">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-white/60">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No notifications yet</p>
              <p className="text-sm">We'll let you know when something important happens.</p>
            </div>
          ) : Array.isArray(notifications) ? (
            notifications.map((notification: Notification) => (
              <div
                key={notification.id}
                className={cn(
                  "p-4 border-b border-white/10 hover:bg-tsCard/50 cursor-pointer transition-colors relative group",
                  !notification.isRead && "bg-tsCard/30"
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">{getNotificationIcon(notification)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4
                        className={cn(
                          "text-sm font-medium text-white leading-5",
                          !notification.isRead && "font-semibold"
                        )}
                      >
                        {notification.title}
                      </h4>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-ts-orange hover:text-ts-orange hover:bg-tsCard"
                            onClick={(e) => handleMarkAsRead(e, notification.id)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-white/60 hover:text-white hover:bg-tsCard"
                          onClick={(e) => handleArchive(e, notification.id)}
                        >
                          <Archive className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-sm text-white/70 leading-5 mt-1">{notification.message}</p>

                    {notification.actionText && notification.actionUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 text-xs border-ts-orange/30 text-ts-orange hover:bg-ts-orange hover:text-black"
                      >
                        {notification.actionText}
                      </Button>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-white/60">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </span>

                      {notification.priority !== "normal" && (
                        <Badge
                          variant="outline"
                          className={cn("text-xs border-0", priorityColors[notification.priority])}
                        >
                          {notification.priority}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {!notification.isRead && (
                    <div className="w-2 h-2 bg-ts-orange rounded-full mt-2 flex-shrink-0"></div>
                  )}
                </div>
              </div>
            ))
          ) : null}
        </ScrollArea>

        <DropdownMenuSeparator className="bg-tsCard/50" />

        <div className="p-2">
          <DropdownMenuItem className="text-ts-orange hover:text-ts-orange hover:bg-tsCard focus:bg-tsCard focus:text-ts-orange">
            <Settings className="h-4 w-4 mr-2" />
            Notification Settings
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
