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
  autoDemoText?: string;
  enableAutoDemo?: boolean;
  autoRouteEnabled: boolean;
  onToggleAutoRoute: (enabled: boolean) => void;
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
  autoDemoText,
  enableAutoDemo,
  autoRouteEnabled,
  onToggleAutoRoute,
}: ScoutInputRowProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {heroLocationLabel && (
            <>
              <span className="inline-flex items-center rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300">
                Area: {heroLocationLabel}
              </span>
              <button
                type="button"
                onClick={onOpenLocationSettings}
                className="inline-flex items-center rounded-md border border-slate-700/70 px-2 py-1 text-[11px] text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
              >
                Change
              </button>
              <button
                type="button"
                onClick={onUseDeviceLocation}
                disabled={isUpdatingGeo}
                className="inline-flex items-center rounded-md border border-slate-700/70 px-2 py-1 text-[11px] text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200 disabled:opacity-50 disabled:cursor-default"
              >
                {isUpdatingGeo ? "Updating..." : "Use device"}
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-700/70 px-2 py-1 text-[11px] text-slate-400">
            <input
              type="checkbox"
              checked={autoRouteEnabled}
              onChange={(e) => onToggleAutoRoute(e.target.checked)}
              className="h-3.5 w-3.5 accent-slate-200"
            />
            Auto-open high-confidence routes
          </label>
        </div>
      </div>
      <ScoutInput
        key={prefillKey}
        disabled={isBusy}
        placeholder="Describe what you need help with..."
        onSend={onSend}
        onUserTyping={onTyping}
        prefillKey="scout-main"
        initialValue=""
        autoDemoText={autoDemoText}
        enableAutoDemo={enableAutoDemo}
      />
    </div>
  );
}
