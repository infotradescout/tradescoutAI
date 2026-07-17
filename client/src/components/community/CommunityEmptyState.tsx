import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Plus } from "lucide-react";

export interface CommunityEmptyStateProps {
  onCreateFirstPost?: () => void;
}

export function CommunityEmptyState({ onCreateFirstPost }: CommunityEmptyStateProps) {
  return (
    <Card className="bg-tsCard border border-white/10 shadow-sm">
      <CardContent className="py-10 text-center space-y-5">
        <MessageSquare className="w-12 h-12 mx-auto text-ts-orange/45" />
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">You&apos;re here early</h3>
          <p className="text-white/70 text-sm max-w-xl mx-auto">
            Your local community is just getting started. Ask the first question, recommend someone
            great, or share something worth knowing.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 text-xs text-white/70">
          <span className="px-3 py-1 rounded-full bg-ts-orange/10 border border-ts-orange/30">
            "Looking for an electrician in our area"
          </span>
          <span className="px-3 py-1 rounded-full bg-ts-orange/10 border border-ts-orange/30">
            "Sharing photos from a recent repair"
          </span>
          <span className="px-3 py-1 rounded-full bg-ts-orange/10 border border-ts-orange/30">
            "Heads up about a local safety issue"
          </span>
        </div>
        {onCreateFirstPost && (
          <Button
            onClick={onCreateFirstPost}
            className="bg-ts-orange hover:bg-ts-orange-dark text-white px-6 py-5 text-sm mt-1"
          >
            <Plus className="w-4 h-4 mr-2" />
            Start the conversation
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
