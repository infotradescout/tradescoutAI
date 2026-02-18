import React, { useState } from "react";
import type { Objective } from "@shared/types/objective";

type ObjectiveChipProps = {
  objective: Objective;
  onRename: (id: string, title: string) => Promise<void>;
  onPause: (id: string) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
};

export function ObjectiveChip({
  objective,
  onRename,
  onPause,
  onComplete,
  onDelete,
  isLoading = false,
}: ObjectiveChipProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(objective.title ?? "");
  const [showActions, setShowActions] = useState(false);

  const handleSaveTitle = async () => {
    const nextTitle = editTitle.trim();
    if (nextTitle && nextTitle !== objective.title) {
      await onRename(objective.id, nextTitle);
    }
    setIsEditing(false);
  };

  const statusColor: Record<Objective["status"], string> = {
    active: "bg-blue-100 border-blue-300",
    paused: "bg-gray-100 border-gray-300",
    completed: "bg-green-100 border-green-300",
    abandoned: "bg-red-100 border-red-300",
  };

  const statusIcon: Record<Objective["status"], string> = {
    active: "*",
    paused: "||",
    completed: "OK",
    abandoned: "X",
  };

  return (
    <div className={`mb-3 rounded border p-2 ${statusColor[objective.status]}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-xs font-bold">{statusIcon[objective.status]}</span>

          {isEditing ? (
            <input
              autoFocus
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSaveTitle();
                if (e.key === "Escape") setIsEditing(false);
              }}
              className="min-w-0 flex-1 rounded px-2 py-1 text-sm font-semibold"
              placeholder="Objective title..."
            />
          ) : (
            <button
              onClick={() => {
                setEditTitle(objective.title ?? "");
                setIsEditing(true);
              }}
              className="min-w-0 flex-1 truncate text-left text-sm font-semibold hover:underline"
              title={objective.title}
              disabled={isLoading}
            >
              {objective.title}
            </button>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowActions((s) => !s)}
            className="rounded px-2 py-1 text-xs hover:bg-black/10 disabled:opacity-50"
            disabled={isLoading}
            title="More options"
          >
            ...
          </button>

          {showActions && (
            <div className="absolute right-0 z-50 mt-1 min-w-max rounded border bg-white shadow-lg">
              {objective.status !== "completed" && (
                <button
                  onClick={async () => {
                    await onComplete(objective.id);
                    setShowActions(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-gray-100"
                >
                  Mark Complete
                </button>
              )}

              {objective.status !== "paused" && objective.status !== "completed" && (
                <button
                  onClick={async () => {
                    await onPause(objective.id);
                    setShowActions(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-gray-100"
                >
                  Pause
                </button>
              )}

              <button
                onClick={async () => {
                  await onDelete(objective.id);
                  setShowActions(false);
                }}
                className="block w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-1 text-xs text-gray-600">
        {objective.linkedObjectType && objective.linkedObjectType !== "none" ? (
          <span className="inline-block rounded bg-white/50 px-2 py-1">
            Linked to {objective.linkedObjectType}
          </span>
        ) : (
          <span className="inline-block rounded bg-white/50 px-2 py-1">
            {intentClassLabel(objective.intentClass)}
          </span>
        )}
      </div>
    </div>
  );
}

function intentClassLabel(intentClass: Objective["intentClass"]): string {
  const labels: Record<Objective["intentClass"], string> = {
    unknown: "Understanding...",
    knowledge: "Learning",
    local_advice: "Local Advice",
    work_request: "Work/Project",
    marketplace_buy: "Shopping",
    marketplace_sell: "Selling",
    community_post: "Community",
    event: "Event",
    safety_report: "Safety",
    account: "Account",
    admin: "Admin",
    other: "Other",
  };
  return labels[intentClass] || "Other";
}

export default ObjectiveChip;
