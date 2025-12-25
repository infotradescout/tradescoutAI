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
}: ScoutInputRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-slate-500 font-medium">What are you working on today?</p>
        {heroLocationLabel && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenLocationSettings}
              className="text-[12px] px-2 py-0.5 rounded-full transition-colors"
              style={{ backgroundColor: 'color-mix(in oklab, var(--theme-bg-quaternary) 80%, transparent)', border: '1px solid var(--theme-border-secondary)', color: 'var(--theme-text-secondary)' }}
            >
              📍 {heroLocationLabel}
            </button>
            <button
              type="button"
              onClick={onUseDeviceLocation}
              disabled={isUpdatingGeo}
              className="text-[11px] text-slate-500 hover:text-slate-300 disabled:opacity-60 disabled:cursor-default"
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
        autoDemoText={autoDemoText}
        enableAutoDemo={enableAutoDemo}
      />
    </div>
  );
}
