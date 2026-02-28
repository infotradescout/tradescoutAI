import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
}

export function EmptyState({
  title = "You're ready to get started",
  message,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center bg-tsBg text-white px-4 py-24">
      <Card className="max-w-xl w-full bg-tsCard/80 border-white/10">
        <CardContent className="py-10 flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-tsCard flex items-center justify-center">
            <Inbox className="h-6 w-6 text-white/70" />
          </div>
          <div>
            <p className="text-lg font-semibold">{title}</p>
            <p className="text-white/60 mt-1">{message}</p>
          </div>
          {action ? <div>{action}</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default EmptyState;
