import { useAuth } from '@/hooks/useAuth';
import { MessagingPanel } from '@/components/MessagingPanel';
import { Loader2 } from 'lucide-react';

export default function MessagesPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Please log in to access messages</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 p-4">
      <div className="h-full max-w-6xl mx-auto">
        <MessagingPanel userId={user.id} />
      </div>
    </div>
  );
}
