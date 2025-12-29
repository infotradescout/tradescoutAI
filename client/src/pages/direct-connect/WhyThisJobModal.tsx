import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export type ScoreSnapshot = {
  score?: number;
  reasons?: string[];
  distanceMiles?: number;
  tradeMatch?: boolean;
  recommendationCount?: number;
  responseRate?: number;
} | null | undefined;

type WhyThisJobModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: ScoreSnapshot;
};

function mapReasonToCopy(reason: string): string {
  if (reason === "Local provider") {
    return "Youre a local provider in this county.";
  }
  if (reason === "Regional provider serving this county") {
    return "You actively serve this area.";
  }
  if (reason === "Serves this county and surrounding areas") {
    return "You serve this county and nearby areas.";
  }

  const match = reason.match(/^(\d+) neighbor recommendations$/i);
  if (match) {
    const count = Number(match[1] || "0");
    if (!Number.isNaN(count) && count > 0) {
      return `Recommended by ${count} neighbor${count === 1 ? "" : "s"}.`;
    }
  }

  return reason;
}

export function WhyThisJobModal({ open, onOpenChange, snapshot }: WhyThisJobModalProps) {
  const rawReasons = snapshot?.reasons || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Why this job?</DialogTitle>
          <DialogDescription>
            Scout matched you to this request based on your service area, reputation, and past activity.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 space-y-2 text-sm text-gray-200">
          {rawReasons.length === 0 ? (
            <p>We matched you based on your profile and service area.</p>
          ) : (
            <ul className="list-disc list-inside space-y-1">
              {rawReasons.map((reason) => (
                <li key={reason}>{mapReasonToCopy(reason)}</li>
              ))}
            </ul>
          )}

          {typeof snapshot?.recommendationCount === "number" && snapshot.recommendationCount > 0 && (
            <p className="pt-2 text-xs text-gray-400">
              Neighbors who worked with you in the past helped this match.
            </p>
          )}

          {typeof snapshot?.score === "number" && (
            <p className="pt-1 text-xs text-gray-400 flex items-center gap-2">
              <Badge variant="outline" className="border-navy-500 text-gray-200">
                Match score: {Math.round(snapshot.score)}
              </Badge>
              <span>Higher scores mean a stronger fit for this request.</span>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
