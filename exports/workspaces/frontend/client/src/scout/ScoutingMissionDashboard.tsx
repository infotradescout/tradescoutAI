/**
 * Scouting Mission Dashboard
 *
 * User dashboard for managing and searching scouting reports.
 * Shows history, saved reports, and quick access to common missions.
 */

import React, { useState } from "react";
import clsx from "clsx";

export interface ScoutingMission {
  id: string;
  mission: string;
  date: string;
  jurisdiction?: string;
  confidence: "high" | "medium" | "low";
  sources: string[];
  saved: boolean;
  pinned: boolean;
}

interface ScoutingMissionDashboardProps {
  missions: ScoutingMission[];
  onMissionClick: (mission: ScoutingMission) => void;
  onNewMission: () => void;
  onDeleteMission: (id: string) => void;
  onSaveMission: (id: string) => void;
  onPinMission: (id: string) => void;
}

const QUICK_MISSIONS = [
  { icon: "🏠", label: "Building Codes", description: "Permits, codes, inspections" },
  { icon: "💰", label: "Pricing", description: "Materials, labor, estimates" },
  { icon: "👷", label: "Contractors", description: "Licensed trades nearby" },
  { icon: "📋", label: "Local Rules", description: "Jurisdiction requirements" },
];

const confidenceColors = {
  high: "bg-green-100 text-green-800 border-green-300",
  medium: "bg-orange-100 text-orange-800 border-orange-300",
  low: "bg-red-100 text-red-800 border-red-300",
};

export function ScoutingMissionDashboard({
  missions,
  onMissionClick,
  onNewMission,
  onDeleteMission,
  onSaveMission,
  onPinMission,
}: ScoutingMissionDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "saved" | "pinned">("all");
  const [sortBy, setSortBy] = useState<"recent" | "confidence" | "alphabetical">("recent");

  // Filter missions
  const filteredMissions = missions.filter((m) => {
    if (filterType === "saved" && !m.saved) return false;
    if (filterType === "pinned" && !m.pinned) return false;
    if (searchQuery && !m.mission.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Sort missions
  const sortedMissions = [...filteredMissions].sort((a, b) => {
    if (sortBy === "recent") {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    } else if (sortBy === "confidence") {
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    } else {
      return a.mission.localeCompare(b.mission);
    }
  });

  const pinnedMissions = sortedMissions.filter((m) => m.pinned);
  const regularMissions = sortedMissions.filter((m) => !m.pinned);

  return (
    <div className="w-full min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 px-6 py-8 border-b border-blue-700">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <span className="text-4xl">🔍</span>
          Scouting Mission Dashboard
        </h1>
        <p className="text-blue-200">Manage and search your intelligence reports</p>
      </div>

      {/* Quick Mission Buttons */}
      <div className="px-6 py-6 border-b border-gray-700">
        <h2 className="text-lg font-semibold mb-4 text-gray-300">Quick Missions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK_MISSIONS.map((quickMission, idx) => (
            <button
              key={idx}
              onClick={onNewMission}
              className="p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500 rounded-lg transition-all text-left group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                {quickMission.icon}
              </div>
              <p className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                {quickMission.label}
              </p>
              <p className="text-sm text-gray-400 mt-1">{quickMission.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="px-6 py-6 border-b border-gray-700 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search missions..."
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <span className="absolute right-3 top-2.5 text-gray-500">🔍</span>
          </div>

          {/* New Mission Button */}
          <button
            onClick={onNewMission}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors whitespace-nowrap"
          >
            + New Mission
          </button>
        </div>

        {/* Filter & Sort */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType("all")}
              className={clsx(
                "px-4 py-2 rounded-lg font-medium transition-colors",
                filterType === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilterType("saved")}
              className={clsx(
                "px-4 py-2 rounded-lg font-medium transition-colors",
                filterType === "saved"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              )}
            >
              📥 Saved
            </button>
            <button
              onClick={() => setFilterType("pinned")}
              className={clsx(
                "px-4 py-2 rounded-lg font-medium transition-colors",
                filterType === "pinned"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              )}
            >
              📌 Pinned
            </button>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="recent">Sort: Recent</option>
            <option value="confidence">Sort: Confidence</option>
            <option value="alphabetical">Sort: A-Z</option>
          </select>
        </div>
      </div>

      {/* Pinned Missions */}
      {pinnedMissions.length > 0 && (
        <div className="px-6 py-6 border-b border-gray-700">
          <h2 className="text-lg font-semibold mb-4 text-gray-300 flex items-center gap-2">
            <span>📌</span>
            Pinned Missions
          </h2>
          <div className="space-y-3">
            {pinnedMissions.map((mission) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                onClick={() => onMissionClick(mission)}
                onDelete={() => onDeleteMission(mission.id)}
                onSave={() => onSaveMission(mission.id)}
                onPin={() => onPinMission(mission.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Regular Missions */}
      <div className="px-6 py-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-300 flex items-center gap-2">
          <span>📋</span>
          {filterType === "saved" ? "Saved Missions" : "Recent Missions"}
          <span className="text-sm text-gray-500 ml-auto">({regularMissions.length})</span>
        </h2>

        {regularMissions.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
            <p className="text-gray-400 text-lg mb-2">No missions yet</p>
            <p className="text-gray-500 text-sm mb-4">
              {searchQuery ? "Try a different search" : "Start by creating a new scouting mission"}
            </p>
            <button
              onClick={onNewMission}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
            >
              + New Mission
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {regularMissions.map((mission) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                onClick={() => onMissionClick(mission)}
                onDelete={() => onDeleteMission(mission.id)}
                onSave={() => onSaveMission(mission.id)}
                onPin={() => onPinMission(mission.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Mission Card Component
 */
function MissionCard({
  mission,
  onClick,
  onDelete,
  onSave,
  onPin,
}: {
  mission: ScoutingMission;
  onClick: () => void;
  onDelete: () => void;
  onSave: () => void;
  onPin: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="p-4 bg-gray-800 border border-gray-700 rounded-lg hover:border-blue-500 transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
            {mission.mission}
          </h3>
          {mission.jurisdiction && (
            <p className="text-sm text-gray-400 mt-1">📍 {mission.jurisdiction}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span
              className={clsx(
                "px-2 py-1 rounded text-xs font-semibold border",
                confidenceColors[mission.confidence]
              )}
            >
              {mission.confidence.toUpperCase()}
            </span>
            <span className="text-xs text-gray-500">
              {new Date(mission.date).toLocaleDateString()}
            </span>
            <div className="flex gap-1">
              {mission.sources.slice(0, 2).map((source, idx) => (
                <span key={idx} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                  {source}
                </span>
              ))}
              {mission.sources.length > 2 && (
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                  +{mission.sources.length - 2}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="ml-4 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPin();
            }}
            className="p-2 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-yellow-400"
            title={mission.pinned ? "Unpin" : "Pin"}
          >
            {mission.pinned ? "📌" : "📍"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
            className="p-2 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-blue-400"
            title={mission.saved ? "Remove" : "Save"}
          >
            {mission.saved ? "📥" : "📤"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowActions(!showActions);
            }}
            className="p-2 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-white"
          >
            ⋮
          </button>
        </div>
      </div>

      {/* More Actions */}
      {showActions && (
        <div className="mt-3 pt-3 border-t border-gray-700 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="px-3 py-1 text-sm bg-red-900 hover:bg-red-800 text-red-200 rounded transition-colors"
          >
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  );
}

// Example usage
export function ScoutingMissionDashboardExample() {
  const [missions] = useState<ScoutingMission[]>([
    {
      id: "1",
      mission: "Building codes for a deck in Austin, TX",
      date: new Date().toISOString(),
      jurisdiction: "Travis County, TX",
      confidence: "high",
      sources: ["Knowledge Base", "Local Data"],
      saved: true,
      pinned: true,
    },
    {
      id: "2",
      mission: "Roofing prices in Harris County",
      date: new Date(Date.now() - 86400000).toISOString(),
      jurisdiction: "Harris County, TX",
      confidence: "medium",
      sources: ["Web Search", "Pricing Data"],
      saved: true,
      pinned: false,
    },
    {
      id: "3",
      mission: "Licensed electricians near me",
      date: new Date(Date.now() - 172800000).toISOString(),
      confidence: "high",
      sources: ["Knowledge Base", "Local Data", "Web Search"],
      saved: false,
      pinned: false,
    },
  ]);

  return (
    <ScoutingMissionDashboard
      missions={missions}
      onMissionClick={(m) => console.log("Click:", m)}
      onNewMission={() => console.log("New mission")}
      onDeleteMission={(id) => console.log("Delete:", id)}
      onSaveMission={(id) => console.log("Save:", id)}
      onPinMission={(id) => console.log("Pin:", id)}
    />
  );
}
