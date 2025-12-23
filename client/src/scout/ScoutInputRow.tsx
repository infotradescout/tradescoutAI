import React from "react";
import ScoutInput from "./ScoutInput";

interface ScoutInputRowProps {
  isBusy: boolean;
  prefillKey: number;
  heroLocationLabel?: string;
  isUpdatingGeo: boolean;
  onOpenLocationSettings: () => void;
  onUseDeviceLocation: () => void;
  onSend: (value: string) => void;
  onTyping: () => void;
}

export function ScoutInputRow({
  isBusy,
  prefillKey,
  heroLocationLabel,
  isUpdatingGeo,
  onOpenLocationSettings,
  onUseDeviceLocation,
  onSend,
  onTyping,
}: ScoutInputRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">What are you working on today?</p>
        {heroLocationLabel && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenLocationSettings}
              className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
            >
              📍 {heroLocationLabel}
            </button>
            <button
              type="button"
              onClick={onUseDeviceLocation}
              disabled={isUpdatingGeo}
              className="text-[10px] text-slate-500 hover:text-slate-300 disabled:opacity-60 disabled:cursor-default"
            >
              Use my location
            </button>
          </div>
        )}
      </div>
      <ScoutInput
        key={prefillKey}
        disabled={isBusy}
        placeholder="Ask Scout about projects, pros, or issues near you…"
        onSend={onSend}
        onUserTyping={onTyping}
        prefillKey="scout-main"
        initialValue=""
      />
    </div>
  );
}
