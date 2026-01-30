import React from "react";
import ScoutInput from "./ScoutInput";
import { Switch } from "@/components/ui/switch";

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
    <div className="space-y-2">
      <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>What are you working on today?</p>
        <div className="flex flex-wrap items-center gap-3">
          {heroLocationLabel && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenLocationSettings}
                className="text-[12px] px-2.5 py-1 rounded-md transition-all hover:opacity-80"
                style={{ backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 70%, var(--theme-accent-primary) 30%)', border: 'none', color: 'var(--text-secondary)' }}
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
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              Auto-route
            </span>
            <Switch
              checked={autoRouteEnabled}
              onCheckedChange={(checked) => onToggleAutoRoute(Boolean(checked))}
            />
          </div>
        </div>
      </div>
      <ScoutInput
        key={prefillKey}
        disabled={isBusy}
        placeholder="Ask Scout about work, pros, or issues near you…"
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
