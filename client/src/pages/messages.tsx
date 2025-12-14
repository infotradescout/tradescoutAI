import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { CommunityShell } from '@/components/layout/CommunityShell';
import { useNotifications } from '@/hooks/useNotifications';
import { MessagesPanel } from '@/components/messages/MessagesPanel';

export default function MessagesPage() {
  const { user, isLoading } = useAuth();
  const { unreadCount } = useNotifications();

  if (isLoading) {
    return (
      <CommunityShell sectionLabel="Messages" notificationsCount={unreadCount}>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </CommunityShell>
    );
  }

  if (!user) {
    return (
      <CommunityShell sectionLabel="Messages" notificationsCount={unreadCount}>
        <div className="flex h-[60vh] items-center justify-center">
          <p className="text-gray-300">Please log in to access messages</p>
        </div>
      </CommunityShell>
    );
  }

  return (
    <CommunityShell sectionLabel="Messages" notificationsCount={unreadCount}>
      <div className="h-[calc(100vh-7rem)] max-w-6xl mx-auto w-full">
        <MessagesPanel />
      </div>
    </CommunityShell>
  );
}
