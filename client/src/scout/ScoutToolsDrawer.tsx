import React from "react";
import { X, Settings, MapPin, Bell } from "lucide-react";

interface ScoutToolsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWorkArea?: (opts: { title: string; url: string }) => void;
}

/**
 * ScoutToolsDrawer - CONTENT ONLY
 * Per architecture rules: ONLY AppShell can render navigation/tools
 * This drawer provides Scout-specific quick links without duplicating nav
 */
export default function ScoutToolsDrawer({
  isOpen,
  onClose,
  onOpenWorkArea,
}: ScoutToolsDrawerProps) {
  if (!isOpen) return null;

  const openOrNavigate = (opts: { title: string; url: string }) => {
    if (onOpenWorkArea) {
      onOpenWorkArea(opts);
      onClose();
      return;
    }
    window.location.href = opts.url;
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        className="flex-1 bg-black/50"
        aria-label="Close tools menu"
        onClick={onClose}
      />
      <div
        className="w-4/5 max-w-xs p-4 shadow-xl shadow-black/50 overflow-y-auto"
        style={{
          backgroundColor: "var(--theme-bg-quaternary)",
          borderLeft: "1px solid var(--theme-border-primary)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Scout Quick Access
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md"
            style={{
              border: "1px solid var(--theme-border-secondary)",
              color: "var(--theme-text-secondary)",
            }}
            aria-label="Close tools menu"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Scout-specific quick links */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => openOrNavigate({ title: "Profile settings", url: "/profile-settings" })}
            className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left"
            style={{
              border: "1px solid var(--theme-border-secondary)",
              color: "var(--theme-text-secondary)",
            }}
          >
            <Settings className="h-4 w-4" />
            <span className="text-sm">Profile & settings</span>
          </button>

          <button
            type="button"
            onClick={() => openOrNavigate({ title: "Set my local area", url: "/settings" })}
            className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left"
            style={{
              border: "1px solid var(--theme-border-secondary)",
              color: "var(--theme-text-secondary)",
            }}
          >
            <MapPin className="h-4 w-4" />
            <span className="text-sm">Set my local area</span>
          </button>

          <button
            type="button"
            onClick={() => openOrNavigate({ title: "Notifications", url: "/notifications" })}
            className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left"
            style={{
              border: "1px solid var(--theme-border-secondary)",
              color: "var(--theme-text-secondary)",
            }}
          >
            <Bell className="h-4 w-4" />
            <span className="text-sm">Notifications</span>
          </button>
        </div>
      </div>
    </div>
  );
}
