import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
}

export function EmptyState({ title = "You're ready to get started", message, action }: EmptyStateProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-900 text-white px-4">
      <Card className="max-w-xl w-full bg-navy-800/80 border-navy-700/70">
        <CardContent className="py-10 flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-navy-700 flex items-center justify-center">
            <Inbox className="h-6 w-6 text-gray-300" />
          </div>
          <div>
            <p className="text-lg font-semibold">{title}</p>
            <p className="text-gray-400 mt-1">{message}</p>
          </div>
          {action ? <div>{action}</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default EmptyState;
