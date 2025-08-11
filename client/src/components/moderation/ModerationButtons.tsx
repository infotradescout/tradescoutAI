import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ChevronUp, ChevronDown, Flag, EyeOff, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ModerationButtonsProps {
  targetType: 'post' | 'comment';
  targetId: string;
  className?: string;
  compact?: boolean; // For comment threads where space is limited
}

interface ModerationScore {
  upvoteCount: number;
  downvoteCount: number;
  flagCount: number;
  hideCount: number;
  communityScore: number;
  isHidden: boolean;
  isFlagged: boolean;
}

interface UserVote {
  voteType: 'upvote' | 'downvote' | 'flag' | 'hide';
  reason?: string;
}

export function ModerationButtons({ targetType, targetId, className = "", compact = false }: ModerationButtonsProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reportReason, setReportReason] = useState("");
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  // Fetch moderation score
  const { data: score, isLoading: scoreLoading } = useQuery({
    queryKey: [`/api/moderation/score/${targetType}/${targetId}`],
    enabled: !!targetId,
  });

  // Fetch user's vote (only if authenticated)
  const { data: userVote } = useQuery({
    queryKey: [`/api/moderation/user-vote/${targetType}/${targetId}`],
    enabled: isAuthenticated && !!targetId,
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async ({ voteType, reason }: { voteType: string; reason?: string }) => {
      return apiRequest("POST", "/api/moderation/vote", {
        targetType,
        targetId,
        voteType,
        reason
      });
    },
    onSuccess: () => {
      // Invalidate both score and user vote queries
      queryClient.invalidateQueries({ queryKey: [`/api/moderation/score/${targetType}/${targetId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/moderation/user-vote/${targetType}/${targetId}`] });
      
      toast({
        title: "Vote submitted",
        description: "Thank you for helping moderate the community!",
      });
    },
    onError: (error) => {
      toast({
        title: "Vote failed",
        description: error.message || "Failed to submit vote",
        variant: "destructive",
      });
    },
  });

  const handleVote = (voteType: string, reason?: string) => {
    if (!isAuthenticated) {
      toast({
        title: "Login required",
        description: "You must be logged in to vote on content",
        variant: "destructive",
      });
      return;
    }

    voteMutation.mutate({ voteType, reason });
  };

  const handleReport = () => {
    if (!reportReason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for reporting this content",
        variant: "destructive",
      });
      return;
    }

    handleVote("flag", reportReason);
    setReportReason("");
    setReportDialogOpen(false);
  };

  if (scoreLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="animate-pulse">Loading votes...</div>
      </div>
    );
  }

  const moderationScore = score as ModerationScore || {
    upvoteCount: 0,
    downvoteCount: 0,
    flagCount: 0,
    hideCount: 0,
    communityScore: 0,
    isHidden: false,
    isFlagged: false
  };

  const currentVote = userVote as UserVote | null;

  if (compact) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <Button
          variant={currentVote?.voteType === 'upvote' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleVote('upvote')}
          disabled={voteMutation.isPending}
          className="h-6 w-6 p-1"
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        
        <span className="text-xs font-medium min-w-[20px] text-center">
          {moderationScore.communityScore > 0 ? `+${moderationScore.communityScore}` : moderationScore.communityScore}
        </span>
        
        <Button
          variant={currentVote?.voteType === 'downvote' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleVote('downvote')}
          disabled={voteMutation.isPending}
          className="h-6 w-6 p-1"
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
        
        {moderationScore.isFlagged && (
          <Flag className="h-3 w-3 text-red-500 ml-1" />
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Upvote/Downvote Section */}
      <div className="flex items-center gap-1">
        <Button
          variant={currentVote?.voteType === 'upvote' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleVote('upvote')}
          disabled={voteMutation.isPending}
          className="h-8 w-8 p-1"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        
        <div className="text-center min-w-[40px]">
          <div className="text-sm font-semibold">
            {moderationScore.communityScore > 0 ? `+${moderationScore.communityScore}` : moderationScore.communityScore}
          </div>
          <div className="text-xs text-gray-500">score</div>
        </div>
        
        <Button
          variant={currentVote?.voteType === 'downvote' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleVote('downvote')}
          disabled={voteMutation.isPending}
          className="h-8 w-8 p-1"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Vote Counts (for transparency) */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <ChevronUp className="h-3 w-3 text-green-500" />
          {moderationScore.upvoteCount}
        </span>
        <span className="flex items-center gap-1">
          <ChevronDown className="h-3 w-3 text-red-500" />
          {moderationScore.downvoteCount}
        </span>
        {moderationScore.flagCount > 0 && (
          <span className="flex items-center gap-1">
            <Flag className="h-3 w-3 text-yellow-500" />
            {moderationScore.flagCount}
          </span>
        )}
      </div>

      {/* Report Button */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant={currentVote?.voteType === 'flag' ? 'destructive' : 'ghost'}
            size="sm"
            className="h-8"
          >
            <Flag className="h-3 w-3 mr-1" />
            Report
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Report Content</DialogTitle>
            <DialogDescription>
              Help keep the community safe by reporting inappropriate content.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason for reporting</Label>
              <Textarea
                id="reason"
                placeholder="Please describe why this content violates community guidelines..."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setReportDialogOpen(false);
                setReportReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReport}
              disabled={voteMutation.isPending || !reportReason.trim()}
            >
              Submit Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hide Button (for trusted moderators) */}
      <Button
        variant={currentVote?.voteType === 'hide' ? 'destructive' : 'ghost'}
        size="sm"
        onClick={() => handleVote('hide')}
        disabled={voteMutation.isPending}
        className="h-8"
      >
        <EyeOff className="h-3 w-3 mr-1" />
        Hide
      </Button>

      {/* Status Indicators */}
      {moderationScore.isHidden && (
        <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
          <EyeOff className="h-3 w-3" />
          Hidden by community
        </div>
      )}
      
      {moderationScore.isFlagged && (
        <div className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
          <Flag className="h-3 w-3" />
          Flagged for review
        </div>
      )}
    </div>
  );
}