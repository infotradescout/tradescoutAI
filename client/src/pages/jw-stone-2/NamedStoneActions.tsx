import { Bookmark, Images, MessageCircle } from "lucide-react";
import type { NamedStoneActionsProps } from "./workspaceTypes";

export function NamedStoneActions({
  item,
  isSaved,
  onToggleSave,
  onOpenDetails,
  onAsk,
  compact = false,
}: NamedStoneActionsProps) {
  if (!item.isEligibleForPublicActions || !item.publicName) return null;

  return (
    <div className={compact ? "jw2-card-actions jw2-card-actions--compact" : "jw2-card-actions"}>
      <button
        className={isSaved ? "jw2-action jw2-action--saved" : "jw2-action"}
        type="button"
        aria-pressed={isSaved}
        aria-label={
          isSaved ? `Remove ${item.publicName} from saved stones` : `Save ${item.publicName}`
        }
        onClick={() => onToggleSave(item)}
      >
        <Bookmark aria-hidden="true" size={16} fill={isSaved ? "currentColor" : "none"} />
        <span>{isSaved ? "Saved" : "Save"}</span>
      </button>
      <button
        className="jw2-action"
        type="button"
        aria-label={`Open ${item.publicName} gallery and details`}
        onClick={() => onOpenDetails(item)}
      >
        <Images aria-hidden="true" size={16} />
        <span>Details</span>
      </button>
      <button className="jw2-action jw2-action--primary" type="button" onClick={() => onAsk(item)}>
        <MessageCircle aria-hidden="true" size={16} />
        <span>Ask about this stone</span>
      </button>
    </div>
  );
}
