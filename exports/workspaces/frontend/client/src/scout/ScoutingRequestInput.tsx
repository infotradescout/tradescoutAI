/**
 * ScoutingRequestInput Component
 *
 * Input interface for sending Scout on a scouting mission.
 * This is NOT a chat input - it's a scouting request input.
 */

import React, { useState } from "react";
import clsx from "clsx";

export interface ScoutingRequestInputProps {
  onSubmit: (request: ScoutingRequest) => void;
  isLoading?: boolean;
  placeholder?: string;
  showLocationPicker?: boolean;
}

export interface ScoutingRequest {
  mission: string;
  location?: {
    county?: string;
    state?: string;
  };
}

const EXAMPLE_MISSIONS = [
  "Scout for building codes for a deck",
  "Scout for roofing prices in my area",
  "Scout for licensed electricians nearby",
  "Scout for permit requirements",
];

export function ScoutingRequestInput({
  onSubmit,
  isLoading = false,
  placeholder = "Scout for...",
  showLocationPicker = true,
}: ScoutingRequestInputProps) {
  const [mission, setMission] = useState("");
  const [county, setCounty] = useState("");
  const [state, setState] = useState("TX");
  const [showExamples, setShowExamples] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mission.trim()) return;

    onSubmit({
      mission: mission.trim(),
      location: showLocationPicker ? { county, state } : undefined,
    });

    setMission("");
  };

  const handleExampleClick = (example: string) => {
    setMission(example);
    setShowExamples(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span className="text-3xl">🔍</span>
          Ready to Scout
        </h2>
        <p className="text-gray-600 mt-1">Send Scout on a mission to gather intelligence</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Mission Input */}
        <div className="relative">
          <label htmlFor="mission" className="block text-sm font-medium text-gray-700 mb-2">
            Scouting Mission
          </label>
          <div className="relative">
            <input
              id="mission"
              type="text"
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              onFocus={() => setShowExamples(true)}
              onBlur={() => setTimeout(() => setShowExamples(false), 200)}
              placeholder={placeholder}
              className={clsx(
                "w-full px-4 py-3 rounded-lg border-2 transition-colors",
                "focus:outline-none focus:border-blue-500",
                mission ? "border-blue-300 bg-blue-50" : "border-gray-300 bg-white"
              )}
              disabled={isLoading}
            />
            <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-2xl">🔍</span>
          </div>

          {/* Example Missions Dropdown */}
          {showExamples && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg z-10">
              <p className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">
                Example Missions
              </p>
              <ul className="py-2">
                {EXAMPLE_MISSIONS.map((example, idx) => (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => handleExampleClick(example)}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 text-gray-700 text-sm transition-colors"
                    >
                      {example}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Location Picker */}
        {showLocationPicker && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="county" className="block text-sm font-medium text-gray-700 mb-2">
                📍 County (Optional)
              </label>
              <input
                id="county"
                type="text"
                value={county}
                onChange={(e) => setCounty(e.target.value)}
                placeholder="e.g., Travis"
                className="w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:border-blue-500 transition-colors"
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                State
              </label>
              <select
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:border-blue-500 transition-colors"
                disabled={isLoading}
              >
                <option value="TX">Texas</option>
                <option value="CA">California</option>
                <option value="NY">New York</option>
                <option value="FL">Florida</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!mission.trim() || isLoading}
          className={clsx(
            "w-full py-3 rounded-lg font-semibold text-white text-lg transition-all",
            isLoading
              ? "bg-gray-400 cursor-not-allowed"
              : mission.trim()
                ? "bg-blue-600 hover:bg-blue-700 active:scale-95"
                : "bg-gray-300 cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block animate-spin">⏳</span>
              Scouting in progress...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span>🔍</span>
              Scout
            </span>
          )}
        </button>
      </form>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>💡 Tip:</strong> Scout gathers intelligence from multiple sources:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-blue-800 ml-4">
          <li>
            📚 <strong>TradeScout Knowledge Base</strong> - Verified data
          </li>
          <li>
            📍 <strong>Local Jurisdiction Data</strong> - Regional rules
          </li>
          <li>
            🌐 <strong>Live Web Search</strong> - Current market data
          </li>
        </ul>
      </div>
    </div>
  );
}

// Example usage
export function ScoutingRequestInputExample() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = (request: ScoutingRequest) => {
    console.log("Scouting request:", request);
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <ScoutingRequestInput onSubmit={handleSubmit} isLoading={loading} />
    </div>
  );
}
