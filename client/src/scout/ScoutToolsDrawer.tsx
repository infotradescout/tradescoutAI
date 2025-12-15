import React from "react";
import { X, Settings, MapPin, Bell } from "lucide-react";
import { Link } from "wouter";

interface ScoutToolsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * ScoutToolsDrawer - CONTENT ONLY
 * Per architecture rules: ONLY AppShell can render navigation/tools
 * This drawer provides Scout-specific quick links without duplicating nav
 */
export default function ScoutToolsDrawer({
  isOpen,
  onClose,
}: ScoutToolsDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        className="flex-1 bg-black/50"
        aria-label="Close tools menu"
        onClick={onClose}
      />
      <div className="w-4/5 max-w-xs bg-slate-950 border-l border-slate-800 p-4 shadow-xl shadow-black/50 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Scout Quick Access
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800"
            aria-label="Close tools menu"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        
        {/* Scout-specific quick links */}
        <div className="space-y-2">
          <Link href="/profile">
            <a
              onClick={onClose}
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-800 hover:bg-slate-800/50 text-slate-300 hover:text-slate-100 transition-colors"
            >
              <Settings className="h-4 w-4" />
              <span className="text-sm">Settings</span>
            </a>
          </Link>
          
          <Link href="/community">
            <a
              onClick={onClose}
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-800 hover:bg-slate-800/50 text-slate-300 hover:text-slate-100 transition-colors"
            >
              <MapPin className="h-4 w-4" />
              <span className="text-sm">Set Location</span>
            </a>
          </Link>
          
          <Link href="/notifications">
            <a
              onClick={onClose}
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-800 hover:bg-slate-800/50 text-slate-300 hover:text-slate-100 transition-colors"
            >
              <Bell className="h-4 w-4" />
              <span className="text-sm">Notifications</span>
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}
