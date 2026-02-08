import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Plus } from "lucide-react";

export interface CommunityEmptyStateProps {
  onCreateFirstPost?: () => void;
}

export function CommunityEmptyState({ onCreateFirstPost }: CommunityEmptyStateProps) {
  return (
    <Card className="bg-tsCard shadow-xl border-2 border-tsBorder">
      <CardContent className="py-16 text-center space-y-6">
        <MessageSquare className="w-16 h-16 mx-auto text-orange-500/40" />
        <div>
          <h3 className="text-2xl font-bold text-white mb-2">
            Start the conversation in your community
          </h3>
          <p className="text-slate-300 text-sm max-w-xl mx-auto">
            Share an update, ask for trusted local signals, or post a tip for your neighbors.
            Your first post helps kick off a more helpful local feed for everyone.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 text-xs text-slate-300">
          <span className="px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30">
            "Looking for a great electrician in our area"
          </span>
          <span className="px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30">
            "Sharing before/after photos from a recent repair or upgrade"
          </span>
          <span className="px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30">
            "Heads up about a local safety issue"
          </span>
        </div>
        {onCreateFirstPost && (
          <Button
            onClick={onCreateFirstPost}
            className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/50 px-8 py-6 text-sm mt-2"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create the first post
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
