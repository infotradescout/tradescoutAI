/**
 * Scout Go
 *
 * Mobile-first, high-contrast interface for job-site scouting.
 * Designed for contractors with dirty hands, poor lighting, and quick decisions.
 *
 * Features:
 * - Large, thumb-friendly buttons (44px minimum)
 * - High contrast for outdoor readability
 * - Voice-to-scout capability
 * - Quick-scan intelligence cards
 * - Offline-capable
 * - Dark mode optimized
 */

import React, { useState, useRef } from "react";
import clsx from "clsx";

export interface ScoutGoMission {
  id: string;
  title: string;
  icon: string;
  description: string;
  action: () => void;
}

export interface QuickIntelligence {
  id: string;
  title: string;
  status: "urgent" | "important" | "info";
  message: string;
  action?: string;
}

interface ScoutGoProps {
  missions: ScoutGoMission[];
  recentIntelligence: QuickIntelligence[];
  onVoiceInput?: (transcript: string) => void;
  onMissionStart: (missionId: string) => void;
  onIntelligenceAction: (intelligenceId: string) => void;
}

const QUICK_MISSIONS: ScoutGoMission[] = [
  {
    id: "codes",
    title: "Codes",
    icon: "📋",
    description: "Building codes & permits",
    action: () => console.log("Scout for codes"),
  },
  {
    id: "prices",
    title: "Prices",
    icon: "💰",
    description: "Materials & labor",
    action: () => console.log("Scout for prices"),
  },
  {
    id: "local",
    title: "Local",
    icon: "📍",
    description: "Jurisdiction rules",
    action: () => console.log("Scout for local"),
  },
  {
    id: "trades",
    title: "Trades",
    icon: "👷",
    description: "Licensed contractors",
    action: () => console.log("Scout for trades"),
  },
];

const statusColors = {
  urgent: "bg-red-900 border-red-600 text-red-100",
  important: "bg-orange-900 border-orange-600 text-orange-100",
  info: "bg-blue-900 border-blue-600 text-blue-100",
};

const statusIcons = {
  urgent: "🚨",
  important: "⚠️",
  info: "ℹ️",
};

export function ScoutGo({
  missions = QUICK_MISSIONS,
  recentIntelligence = [],
  onVoiceInput,
  onMissionStart,
  onIntelligenceAction,
}: ScoutGoProps) {
  const [isListening, setIsListening] = useState(false);
  const [selectedMission, setSelectedMission] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize speech recognition
  const startVoiceInput = () => {
    if (!onVoiceInput) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input not supported on this device");
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join("");
        onVoiceInput(transcript);
      };
    }

    recognitionRef.current.start();
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header - Minimal, High Contrast */}
      <div className="bg-black border-b-4 border-blue-500 px-4 py-3 flex items-center justify-between">
        <h1 className="text-2xl font-black">🔍 SCOUT GO</h1>
        <div className="flex gap-2">
          {isListening && <span className="animate-pulse text-red-500 text-xl">🎤</span>}
        </div>
      </div>

      {/* Voice Input Section */}
      <div className="px-4 py-4 border-b border-gray-800">
        {!isListening ? (
          <button
            onClick={startVoiceInput}
            className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-lg border-2 border-blue-400 active:bg-blue-800 transition-colors"
          >
            🎤 SCOUT BY VOICE
          </button>
        ) : (
          <button
            onClick={stopVoiceInput}
            className="w-full py-4 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-lg rounded-lg border-2 border-red-400 active:bg-red-800 transition-colors animate-pulse"
          >
            🛑 STOP LISTENING
          </button>
        )}
      </div>

      {/* Quick Missions - Large, Thumb-Friendly Buttons */}
      <div className="px-4 py-4 border-b border-gray-800">
        <p className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Quick Scout</p>
        <div className="grid grid-cols-2 gap-3">
          {missions.map((mission) => (
            <button
              key={mission.id}
              onClick={() => {
                setSelectedMission(mission.id);
                onMissionStart(mission.id);
              }}
              className={clsx(
                "p-4 rounded-lg border-2 font-bold text-center transition-all active:scale-95",
                selectedMission === mission.id
                  ? "bg-blue-600 border-blue-400 text-white"
                  : "bg-gray-800 border-gray-700 text-white hover:border-blue-500"
              )}
            >
              <div className="text-3xl mb-2">{mission.icon}</div>
              <p className="text-sm font-bold">{mission.title}</p>
              <p className="text-xs text-gray-300 mt-1">{mission.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Intelligence - Alert-Style Cards */}
      {recentIntelligence.length > 0 && (
        <div className="px-4 py-4 border-b border-gray-800 flex-1 overflow-y-auto">
          <p className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">
            Recent Intel
          </p>
          <div className="space-y-3">
            {recentIntelligence.map((intel) => (
              <div
                key={intel.id}
                className={clsx(
                  "p-4 rounded-lg border-2 cursor-pointer transition-all active:scale-95",
                  statusColors[intel.status]
                )}
                onClick={() => onIntelligenceAction(intel.id)}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{statusIcons[intel.status]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{intel.title}</p>
                    <p className="text-xs mt-1 line-clamp-2">{intel.message}</p>
                    {intel.action && (
                      <p className="text-xs font-bold mt-2 opacity-75">→ {intel.action}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {recentIntelligence.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <p className="text-5xl mb-3">🔍</p>
          <p className="text-lg font-bold">No Recent Intel</p>
          <p className="text-sm text-gray-400 mt-2">
            Start a scouting mission to gather intelligence
          </p>
        </div>
      )}

      {/* Bottom Navigation - Simple, Thumb-Friendly */}
      <div className="border-t border-gray-800 bg-black px-4 py-3 flex gap-2 justify-between">
        <button className="flex-1 py-3 px-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold text-sm transition-colors">
          📊 History
        </button>
        <button className="flex-1 py-3 px-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold text-sm transition-colors">
          ⚙️ Settings
        </button>
        <button className="flex-1 py-3 px-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold text-sm transition-colors">
          ℹ️ Help
        </button>
      </div>
    </div>
  );
}

/**
 * Scout Go Detail View
 * Shows full intelligence report for a specific mission
 */
export function ScoutGoDetail({
  mission,
  intelligence,
  onBack,
  onShare,
}: {
  mission: ScoutGoMission;
  intelligence: any;
  onBack: () => void;
  onShare: () => void;
}) {
  return (
    <div className="w-full min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="bg-black border-b-4 border-blue-500 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-2xl p-2 hover:bg-gray-800 rounded transition-colors"
        >
          ←
        </button>
        <div className="flex-1">
          <p className="text-xs text-gray-400 uppercase">Scouting Report</p>
          <p className="text-lg font-bold flex items-center gap-2">
            <span>{mission.icon}</span>
            {mission.title}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Mission Info */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase mb-2">Mission</p>
          <p className="font-bold text-lg">{mission.title}</p>
          <p className="text-sm text-gray-300 mt-2">{mission.description}</p>
        </div>

        {/* Intelligence Report */}
        {intelligence && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-xs text-gray-400 uppercase mb-2">Intelligence</p>
            <div className="space-y-3">
              {intelligence.findings &&
                intelligence.findings.map((finding: any, idx: number) => (
                  <div key={idx} className="bg-gray-900 rounded p-3 border-l-2 border-blue-500">
                    <p className="text-sm font-bold">{finding.title}</p>
                    <p className="text-xs text-gray-300 mt-1">{finding.content}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Sources */}
        {intelligence && intelligence.sources && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-xs text-gray-400 uppercase mb-2">Sources</p>
            <div className="flex flex-wrap gap-2">
              {intelligence.sources.map((source: string, idx: number) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-blue-900 text-blue-100 rounded-full text-xs font-bold"
                >
                  {source}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="border-t border-gray-800 bg-black px-4 py-3 space-y-2">
        <button
          onClick={onShare}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg border-2 border-blue-400 active:bg-blue-800 transition-colors"
        >
          📤 SHARE
        </button>
        <button
          onClick={onBack}
          className="w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg border-2 border-gray-600 active:bg-gray-900 transition-colors"
        >
          ← BACK
        </button>
      </div>
    </div>
  );
}

// Example usage
export function ScoutGoExample() {
  const [showDetail, setShowDetail] = useState(false);
  const [selectedMission, setSelectedMission] = useState<ScoutGoMission | null>(null);

  const recentIntelligence: QuickIntelligence[] = [
    {
      id: "1",
      title: "Code Update",
      status: "urgent",
      message: 'Travis County updated deck railing requirements to 42" minimum',
      action: "Review",
    },
    {
      id: "2",
      title: "Price Alert",
      status: "important",
      message: "Lumber prices up 8% this week in your area",
      action: "View",
    },
    {
      id: "3",
      title: "Contractor Found",
      status: "info",
      message: "3 licensed electricians available in your area",
      action: "Contact",
    },
  ];

  if (showDetail && selectedMission) {
    return (
      <ScoutGoDetail
        mission={selectedMission}
        intelligence={{
          findings: [
            { title: "Requirement", content: "Deck railings must be 42 inches minimum" },
            { title: "Inspection", content: "Electrical inspection required" },
          ],
          sources: ["Travis County", "Building Codes", "Local Data"],
        }}
        onBack={() => setShowDetail(false)}
        onShare={() => alert("Shared!")}
      />
    );
  }

  return (
    <ScoutGo
      missions={QUICK_MISSIONS}
      recentIntelligence={recentIntelligence}
      onVoiceInput={(transcript) => console.log("Voice:", transcript)}
      onMissionStart={(missionId) => {
        const mission = QUICK_MISSIONS.find((m) => m.id === missionId);
        if (mission) {
          setSelectedMission(mission);
          setShowDetail(true);
        }
      }}
      onIntelligenceAction={(id) => alert(`Action on intel: ${id}`)}
    />
  );
}
