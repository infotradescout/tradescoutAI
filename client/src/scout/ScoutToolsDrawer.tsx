import React from "react";
import { X } from "lucide-react";
import { RightToolsPanel } from "../components/layout/RightToolsPanel";

interface ScoutToolsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

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
            Tools &amp; Personalization
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
        <RightToolsPanel />
      </div>
    </div>
  );
}
