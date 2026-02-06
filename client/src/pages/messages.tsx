import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import MessagesPanel from "@/components/messages/MessagesPanel";

export default function MessagesPage() {
  const { user, isLoading } = useAuth();
  const { unreadCount } = useNotifications();

  if (isLoading) {
    return (
      <div className="">
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="">
        <div className="flex h-[60vh] items-center justify-center">
          <p className="text-gray-300">Please log in to access messages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      <div className="h-[calc(100vh-7rem)] max-w-6xl mx-auto w-full">
        <MessagesPanel />
      </div>
    </div>
  );
}
