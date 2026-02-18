/**
 * ObjectiveChip Component
 *
 * Renders the active objective state in Scout UI (top of conversation)
 * Phase 1: Shows title, status, allows rename/pause/complete/delete
 * Phase 2: Will add linked object status and promotion status
 */

import React, { useState } from "react";
import type { Objective } from "@shared/schema";

interface ObjectiveChipProps {
  objective: Objective | null;
  onStatusChange?: (status: "active" | "paused" | "completed" | "abandoned") => void;
  onTitleChange?: (newTitle: string) => void;
  onDelete?: () => void;
  isLoading?: boolean;
}

export function ObjectiveChip({
  objective,
  onStatusChange,
  onTitleChange,
  onDelete,
  isLoading = false,
}: ObjectiveChipProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(objective?.title || "");
  const [showActions, setShowActions] = useState(false);

  if (!objective) {
    return null;
  }

  const handleSaveTitle = async () => {
    if (editTitle && editTitle !== objective.title) {
      await onTitleChange?.(editTitle);
    }
    setIsEditing(false);
  };

  // Status color indicators
  const statusColor: Record<string, string> = {
    active: "bg-blue-100 border-blue-300",
    paused: "bg-gray-100 border-gray-300",
    completed: "bg-green-100 border-green-300",
    abandoned: "bg-red-100 border-red-300",
  };

  const statusIcon: Record<string, string> = {
    active: "●",
    paused: "⏸",
    completed: "✓",
    abandoned: "✕",
  };

  return (
    <div className={`mb-3 p-2 border rounded ${statusColor[objective.status]}`}>
      <div className="flex items-center justify-between gap-2">
        {/* Status indicator + title */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-bold">{statusIcon[objective.status]}</span>

          {isEditing ? (
            <input
              autoFocus
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveTitle();
                if (e.key === "Escape") setIsEditing(false);
              }}
              className="text-sm font-semibold px-2 py-1 rounded flex-1 min-w-0"
              placeholder="Objective title..."
            />
          ) : (
            <button
              onClick={() => {
                setEditTitle(objective.title);
                setIsEditing(true);
              }}
              className="text-sm font-semibold truncate hover:underline text-left flex-1 min-w-0"
              title={objective.title}
            >
              {objective.title}
            </button>
          )}
        </div>

        {/* Action button */}
        <div className="relative">
          <button
            onClick={() => setShowActions(!showActions)}
            className="text-xs px-2 py-1 rounded hover:bg-black/10 disabled:opacity-50"
            disabled={isLoading}
            title="More options"
          >
            ⋯
          </button>

          {showActions && (
            <div className="absolute right-0 mt-1 bg-white border rounded shadow-lg z-50 min-w-max">
              {objective.status !== "completed" && (
                <button
                  onClick={() => {
                    onStatusChange?.("completed");
                    setShowActions(false);
                  }}
                  className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-100"
                >
                  ✓ Mark Complete
                </button>
              )}

              {objective.status !== "paused" && objective.status !== "completed" && (
                <button
                  onClick={() => {
                    onStatusChange?.("paused");
                    setShowActions(false);
                  }}
                  className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-100"
                >
                  ⏸ Pause
                </button>
              )}

              {objective.status === "paused" && (
                <button
                  onClick={() => {
                    onStatusChange?.("active");
                    setShowActions(false);
                  }}
                  className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-100"
                >
                  ▶ Resume
                </button>
              )}

              <button
                onClick={() => {
                  onStatusChange?.("abandoned");
                  onDelete?.();
                  setShowActions(false);
                }}
                className="block w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-600"
              >
                ✕ Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Intent class badge */}
      <div className="mt-1 text-xs text-gray-600">
        {objective.linkedObjectType !== "none" ? (
          <span className="inline-block px-2 py-1 bg-white/50 rounded">
            📎 Linked to {objective.linkedObjectType}
          </span>
        ) : (
          <span className="inline-block px-2 py-1 bg-white/50 rounded">
            {intentClassLabel(objective.intentClass as any)}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * User-friendly label for intent class
 */
function intentClassLabel(intentClass: string): string {
  const labels: Record<string, string> = {
    unknown: "🤔 Understanding...",
    knowledge: "📚 Learning",
    local_advice: "🗣️ Local Advice",
    work_request: "🔨 Work/Project",
    marketplace_buy: "🛍️ Shopping",
    marketplace_sell: "💰 Selling",
    community_post: "👥 Community",
    event: "📅 Event",
    safety_report: "⚠️ Safety",
    account: "👤 Account",
    admin: "⚙️ Admin",
    other: "…",
  };
  return labels[intentClass] || "…";
}

export default ObjectiveChip;
