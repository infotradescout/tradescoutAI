import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Compass, Zap, MapPin } from 'lucide-react';
import { ScoutingRequestInput } from './ScoutingRequestInput';
import { ScoutingReport } from './ScoutingReport';
import { RegionalIntelligenceBrowser } from './RegionalIntelligenceBrowser';
import { DraggableDataTray } from './DraggableDataTray';

/**
 * ScoutOS_ActiveScouting
 * 
 * The new Active Scouting interface for Trade Scout.
 * 
 * This replaces the chat-based UI with a mission-driven intelligence dashboard.
 * 
 * Layout:
 * - Header: "Scout Intelligence Dashboard"
 * - Main Area: Scouting Request Input + Recent Reports
 * - Sidebar: Regional Intelligence Browser (when county selected)
 * - Bottom: Draggable Data Tray for file organization
 */

interface ScoutingMission {
  id: string;
  type: 'codes' | 'pricing' | 'local' | 'contractors';
  target: string;
  county?: string;
  state?: string;
  status: 'pending' | 'in-progress' | 'complete' | 'error';
  report?: any;
  timestamp: Date;
}

export default function ScoutOS_ActiveScouting() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // State for active missions and reports
  const [missions, setMissions] = useState<ScoutingMission[]>([]);
  const [selectedCounty, setSelectedCounty] = useState<string | null>(null);
  const [showRegionalBrowser, setShowRegionalBrowser] = useState(false);

  const handleMissionSubmit = async (missionData: {
    type: 'codes' | 'pricing' | 'local' | 'contractors';
    target: string;
    county?: string;
    state?: string;
  }) => {
    const newMission: ScoutingMission = {
      id: `mission-${Date.now()}`,
      ...missionData,
      status: 'in-progress',
      timestamp: new Date(),
    };

    setMissions((prev) => [newMission, ...prev]);

    try {
      // Call Scout 2.0 API
      const response = await fetch('/api/scout-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Scout for ${missionData.type}: ${missionData.target}`,
          county: missionData.county,
          state: missionData.state,
          missionType: missionData.type,
        }),
      });

      const report = await response.json();

      setMissions((prev) =>
        prev.map((m) =>
          m.id === newMission.id
            ? { ...m, status: 'complete', report }
            : m
        )
      );
    } catch (error) {
      setMissions((prev) =>
        prev.map((m) =>
          m.id === newMission.id
            ? { ...m, status: 'error' }
            : m
        )
      );
    }
  };

  const handleCountySelect = (county: string) => {
    setSelectedCounty(county);
    setShowRegionalBrowser(true);
  };

  return (
    <div className="flex h-full w-full bg-slate-950 text-slate-50">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-800 bg-slate-900 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <Compass className="w-6 h-6 text-orange-500" />
            <h1 className="text-2xl font-bold">Scout Intelligence Dashboard</h1>
          </div>
          <p className="text-sm text-slate-400">
            Active scouting missions for building codes, pricing, and local data
          </p>
        </div>

        {/* Scouting Request Input */}
        <div className="border-b border-slate-800 p-4 sm:p-6 bg-slate-900">
          <ScoutingRequestInput onSubmit={handleMissionSubmit} />
        </div>

        {/* Reports Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {missions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <AlertCircle className="w-12 h-12 text-slate-600 mb-4" />
              <h2 className="text-lg font-semibold text-slate-300 mb-2">
                No Active Missions
              </h2>
              <p className="text-slate-400 mb-6 max-w-md">
                Start a scouting mission to gather intelligence on building codes, pricing, local regulations, or contractors.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {missions.map((mission) => (
                <Card
                  key={mission.id}
                  className="bg-slate-800 border-slate-700 p-4 sm:p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-orange-500">
                          {mission.type}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded ${
                            mission.status === 'complete'
                              ? 'bg-green-900 text-green-200'
                              : mission.status === 'error'
                              ? 'bg-red-900 text-red-200'
                              : 'bg-blue-900 text-blue-200'
                          }`}
                        >
                          {mission.status}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-50 mb-1">
                        {mission.target}
                      </h3>
                      {mission.county && (
                        <p className="text-sm text-slate-400 flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {mission.county}, {mission.state}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      {mission.timestamp.toLocaleTimeString()}
                    </span>
                  </div>

                  {mission.status === 'complete' && mission.report && (
                    <ScoutingReport report={mission.report} />
                  )}

                  {mission.status === 'error' && (
                    <div className="bg-red-900/20 border border-red-800 rounded p-3 text-red-200 text-sm">
                      Failed to complete scouting mission. Please try again.
                    </div>
                  )}

                  {mission.status === 'in-progress' && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Zap className="w-4 h-4 animate-pulse" />
                      <span className="text-sm">Scouting in progress...</span>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Regional Intelligence Browser Sidebar */}
      {showRegionalBrowser && selectedCounty && (
        <div className="w-96 border-l border-slate-800 bg-slate-900 flex flex-col overflow-hidden">
          <div className="border-b border-slate-800 p-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-50">Regional Intelligence</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRegionalBrowser(false)}
              className="text-slate-400 hover:text-slate-50"
            >
              ✕
            </Button>
          </div>
          <RegionalIntelligenceBrowser county={selectedCounty} />
        </div>
      )}

      {/* Draggable Data Tray */}
      <DraggableDataTray onCountySelect={handleCountySelect} />
    </div>
  );
}
