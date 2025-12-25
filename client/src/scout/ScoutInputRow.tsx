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
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>What are you working on today?</p>
        {heroLocationLabel && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenLocationSettings}
              className="text-[12px] px-2.5 py-1 rounded-full transition-all hover:scale-105"
              style={{ backgroundColor: 'color-mix(in oklab, var(--theme-bg-quaternary) 60%, transparent)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}
            >
              📍 {heroLocationLabel}
            </button>
            <button
              type="button"
              onClick={onUseDeviceLocation}
              disabled={isUpdatingGeo}
              className="text-[11px] transition-colors hover:opacity-80 disabled:opacity-50 disabled:cursor-default"
              style={{ color: 'var(--text-secondary)' }}
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
