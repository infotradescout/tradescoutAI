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

  const statusStyle: Record<Objective["status"], React.CSSProperties> = {
    active: {
      backgroundColor: "color-mix(in oklab, var(--theme-accent-primary) 14%, var(--surface-card))",
      borderColor: "var(--border-active)",
    },
    paused: {
      backgroundColor: "color-mix(in oklab, var(--surface-intermediate) 90%, transparent)",
      borderColor: "var(--border-subtle)",
    },
    completed: {
      backgroundColor: "color-mix(in oklab, var(--status-success) 16%, var(--surface-card))",
      borderColor: "var(--border-active)",
    },
    abandoned: {
      backgroundColor: "color-mix(in oklab, var(--status-error) 16%, var(--surface-card))",
      borderColor: "var(--border-active)",
    },
  };

  const statusIcon: Record<Objective["status"], string> = {
    active: "*",
    paused: "||",
    completed: "OK",
    abandoned: "X",
  };

  return (
    <div className="mb-3 rounded border p-2" style={statusStyle[objective.status]}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
            {statusIcon[objective.status]}
          </span>

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
              style={{
                border: "1px solid var(--border-subtle)",
                backgroundColor:
                  "color-mix(in oklab, var(--surface-intermediate) 92%, transparent)",
                color: "var(--text-primary)",
              }}
              placeholder="Objective title..."
            />
          ) : (
            <button
              onClick={() => {
                setEditTitle(objective.title ?? "");
                setIsEditing(true);
              }}
              className="min-w-0 flex-1 truncate text-left text-sm font-semibold hover:underline"
              style={{ color: "var(--text-primary)" }}
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
            className="rounded px-2 py-1 text-xs disabled:opacity-50"
            style={{
              color: "var(--text-secondary)",
              backgroundColor: showActions
                ? "color-mix(in oklab, var(--surface-intermediate) 92%, transparent)"
                : "transparent",
            }}
            disabled={isLoading}
            title="More options"
          >
            ...
          </button>

          {showActions && (
            <div
              className="absolute right-0 z-50 mt-1 min-w-max rounded border shadow-lg"
              style={{
                borderColor: "var(--border-subtle)",
                backgroundColor: "var(--surface-card)",
              }}
            >
              {objective.status !== "completed" && (
                <button
                  onClick={async () => {
                    await onComplete(objective.id);
                    setShowActions(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-xs"
                  style={{ color: "var(--text-primary)" }}
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
                  className="block w-full px-3 py-2 text-left text-xs"
                  style={{ color: "var(--text-primary)" }}
                >
                  Pause
                </button>
              )}

              <button
                onClick={async () => {
                  await onDelete(objective.id);
                  setShowActions(false);
                }}
                className="block w-full px-3 py-2 text-left text-xs"
                style={{ color: "var(--status-error)" }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        {objective.linkedObjectType && objective.linkedObjectType !== "none" ? (
          <span
            className="inline-block rounded px-2 py-1"
            style={{
              backgroundColor: "color-mix(in oklab, var(--surface-intermediate) 92%, transparent)",
              color: "var(--text-secondary)",
            }}
          >
            Linked to {objective.linkedObjectType}
          </span>
        ) : (
          <span
            className="inline-block rounded px-2 py-1"
            style={{
              backgroundColor: "color-mix(in oklab, var(--surface-intermediate) 92%, transparent)",
              color: "var(--text-secondary)",
            }}
          >
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
