import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  priority: 'low' | 'normal' | 'high' | 'urgent' | 'critical';
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
  low: 'text-gray-500',
  normal: 'text-blue-500',
  high: 'text-orange-500', 
  urgent: 'text-red-500',
  critical: 'text-red-600',
};

const iconColors = {
  blue: 'text-blue-500',
  green: 'text-green-500',
  yellow: 'text-yellow-500',
  orange: 'text-orange-500',
  red: 'text-red-500',
  purple: 'text-purple-500',
  pink: 'text-pink-500',
  gold: 'text-yellow-600',
  gray: 'text-gray-500',
};

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch unread count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    queryFn: () => apiRequest('/api/notifications?limit=20'),
    enabled: isOpen,
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest('/api/notifications/mark-all-read', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/notifications/${id}/archive`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
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
    const IconComponent = iconMap[notification.iconName || 'bell'] || Bell;
    const colorClass = iconColors[notification.iconColor as keyof typeof iconColors] || 'text-blue-500';
    
    return <IconComponent className={cn('h-4 w-4', colorClass)} />;
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-96 max-h-[600px] p-0 bg-navy-800/95 backdrop-blur-sm border-navy-600/50"
      >
        <div className="flex items-center justify-between p-4 border-b border-navy-600/50">
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
                className="text-orange-400 hover:text-orange-300 hover:bg-navy-700"
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-white hover:bg-navy-700"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-[500px]">
          {isLoading ? (
            <div className="p-4 text-center text-gray-400">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No notifications yet</p>
              <p className="text-sm">We'll let you know when something important happens.</p>
            </div>
          ) : (
            Array.isArray(notifications) ? notifications.map((notification: Notification) => (
              <div
                key={notification.id}
                className={cn(
                  "p-4 border-b border-navy-600/30 hover:bg-navy-700/50 cursor-pointer transition-colors relative group",
                  !notification.isRead && "bg-navy-700/30"
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={cn(
                        "text-sm font-medium text-white leading-5",
                        !notification.isRead && "font-semibold"
                      )}>
                        {notification.title}
                      </h4>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-orange-400 hover:text-orange-300 hover:bg-navy-600"
                            onClick={(e) => handleMarkAsRead(e, notification.id)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-400 hover:text-white hover:bg-navy-600"
                          onClick={(e) => handleArchive(e, notification.id)}
                        >
                          <Archive className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-300 leading-5 mt-1">
                      {notification.message}
                    </p>
                    
                    {notification.actionText && notification.actionUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 text-xs border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-navy-900"
                      >
                        {notification.actionText}
                      </Button>
                    )}
                    
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </span>
                      
                      {notification.priority !== 'normal' && (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs border-0",
                            priorityColors[notification.priority]
                          )}
                        >
                          {notification.priority}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {!notification.isRead && (
                    <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                  )}
                </div>
              </div>
            )) : null
          )}
        </ScrollArea>

        <DropdownMenuSeparator className="bg-navy-600/50" />
        
        <div className="p-2">
          <DropdownMenuItem className="text-orange-400 hover:text-orange-300 hover:bg-navy-700 focus:bg-navy-700 focus:text-orange-300">
            <Settings className="h-4 w-4 mr-2" />
            Notification Settings
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}